package expo.modules.gaitsensepose

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.net.Uri
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

private const val MODEL = "pose_landmarker_full.task"
private const val MODEL_HASH = "5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1"

internal class PoseStore(context: Context) : SQLiteOpenHelper(context, "gaitsense-offline.db", null, 1) {
  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL("CREATE TABLE sessions (id TEXT PRIMARY KEY, created INTEGER NOT NULL, summary TEXT NOT NULL)")
    db.execSQL("CREATE TABLE frames (session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, timestamp INTEGER NOT NULL, landmarks TEXT NOT NULL, PRIMARY KEY(session_id,timestamp))")
  }
  override fun onConfigure(db: SQLiteDatabase) { db.setForeignKeyConstraintsEnabled(true) }
  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
    error("No migration defined; existing data was not erased")
  }
}

class GaitSensePoseModule : Module() {
  private val executor = Executors.newSingleThreadExecutor()
  private val busy = AtomicBoolean(false)
  private val cancelled = AtomicBoolean(false)
  private val context get() = appContext.reactContext ?: error("Android context unavailable")
  private fun task(promise: Promise, body: () -> Any?) {
    executor.execute {
      try { promise.resolve(body()) }
      catch (error: Exception) { promise.reject("OFFLINE_POSE", error.message ?: "Offline operation failed", error) }
    }
  }
  // Only Expo camera cache videos are accepted: no arbitrary path or content URI deletion.
  private fun cameraFile(uri: String): File {
    val parsed = Uri.parse(uri)
    require(parsed.scheme == "file") { "Only app-local camera recordings are accepted" }
    val file = File(parsed.path ?: error("Missing camera path")).canonicalFile
    val roots = listOfNotNull(context.cacheDir, context.externalCacheDir).map { it.canonicalFile }
    require(roots.any { file.path.startsWith(it.path + File.separator + "Camera" + File.separator) }) {
      "Recording must be inside this app's Camera cache"
    }
    require(file.extension.lowercase() in setOf("mp4", "mov")) { "Unsupported video" }
    return file
  }
  private fun remove(file: File) {
    require(!file.exists() || file.delete()) { "Could not delete temporary recording; retry deletion" }
  }

  override fun definition() = ModuleDefinition {
    Name("GaitSensePose")
    Events("onProgress")
    Function("cancel") { cancelled.set(true) }
    AsyncFunction("clearTemporaryVideos") { promise: Promise ->
      task(promise) {
        require(!busy.get()) { "Wait for processing to stop" }
        var count = 0
        listOfNotNull(context.cacheDir, context.externalCacheDir).forEach { root ->
          File(root, "Camera").listFiles()?.forEach { file ->
            if (file.isFile && file.extension.lowercase() in setOf("mp4", "mov")) {
              remove(cameraFile(Uri.fromFile(file).toString())); count++
            }
          }
        }
        count
      }
    }
    AsyncFunction("discardVideo") { uri: String, promise: Promise ->
      task(promise) { require(!busy.get()) { "Wait for processing to stop" }; remove(cameraFile(uri)); null }
    }
    AsyncFunction("listSessions") { promise: Promise ->
      task(promise) {
        PoseStore(context).use { store ->
          store.readableDatabase.rawQuery("SELECT summary FROM sessions ORDER BY created DESC LIMIT 100", null).use { cursor ->
            val items = JSONArray()
            while (cursor.moveToNext()) items.put(JSONObject(cursor.getString(0)))
            items.toString()
          }
        }
      }
    }
    AsyncFunction("readFrames") { id: String, promise: Promise ->
      task(promise) {
        PoseStore(context).use { store ->
          store.readableDatabase.rawQuery("SELECT timestamp,landmarks FROM frames WHERE session_id=? ORDER BY timestamp", arrayOf(id)).use { cursor ->
            val items = JSONArray()
            while (cursor.moveToNext()) items.put(JSONObject().put("timestampMs", cursor.getLong(0)).put("landmarks", JSONArray(cursor.getString(1))))
            items.toString()
          }
        }
      }
    }
    AsyncFunction("deleteSession") { id: String, promise: Promise ->
      task(promise) { PoseStore(context).use { it.writableDatabase.delete("sessions", "id=?", arrayOf(id)) }; null }
    }
    AsyncFunction("deleteAll") { promise: Promise ->
      task(promise) { require(!busy.get()) { "Wait for processing to stop" }; PoseStore(context).use { it.writableDatabase.delete("sessions", null, null) }; null }
    }
    AsyncFunction("processVideo") { uri: String, view: String, consent: Boolean, promise: Promise ->
      if (!busy.compareAndSet(false, true)) {
        promise.reject("BUSY", "A recording is already being processed", null)
      } else {
        cancelled.set(false)
        executor.execute {
          try { promise.resolve(OfflinePoseProcessor(context, cancelled) { percent ->
            sendEvent("onProgress", mapOf("percent" to percent))
          }.process(uri, view, consent)) }
          catch (error: Exception) { promise.reject("OFFLINE_POSE", error.message ?: "Unable to extract pose", error) }
          finally { busy.set(false) }
        }
      }
    }
    OnDestroy { cancelled.set(true); executor.shutdown() }
  }

}

// The same engine is called by the Expo bridge and Android instrumentation tests.
internal class OfflinePoseProcessor(
  private val context: Context,
  private val cancelled: AtomicBoolean,
  private val onProgress: (Double) -> Unit
) {
  private fun cameraFile(uri: String): File {
    val parsed = Uri.parse(uri)
    require(parsed.scheme == "file") { "Only app-local camera recordings are accepted" }
    val file = File(parsed.path ?: error("Missing camera path")).canonicalFile
    val roots = listOfNotNull(context.cacheDir, context.externalCacheDir).map { it.canonicalFile }
    require(roots.any { file.path.startsWith(it.path + File.separator + "Camera" + File.separator) }) {
      "Recording must be inside this app's Camera cache"
    }
    require(file.extension.lowercase() in setOf("mp4", "mov")) { "Unsupported video" }
    return file
  }
  private fun remove(file: File) {
    require(!file.exists() || file.delete()) { "Could not delete temporary recording; retry deletion" }
  }
  fun process(uri: String, view: String, consent: Boolean): String {
    require(consent) { "Accept the local-processing notice first" }
    require(view in setOf("side_left", "side_right")) { "Choose the visible side" }
    val source = cameraFile(uri)
    require(source.exists() && source.length() in 1..150_000_000L) { "Recording missing or larger than 150 MB" }
    val hash = context.assets.open(MODEL).use { input ->
      val digest = MessageDigest.getInstance("SHA-256")
      val buffer = ByteArray(8192)
      var count = input.read(buffer)
      while (count != -1) { digest.update(buffer, 0, count); count = input.read(buffer) }
      digest.digest().joinToString("") { "%02x".format(it) }
    }
    require(hash == MODEL_HASH) { "Bundled pose model checksum mismatch" }
    val retriever = MediaMetadataRetriever()
    try {
      retriever.setDataSource(source.path)
      val duration = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0
      require(duration in 9500..16000) { "Record approximately 10-15 seconds before processing" }
      val options = PoseLandmarker.PoseLandmarkerOptions.builder()
        .setBaseOptions(BaseOptions.builder().setModelAssetPath(MODEL).build())
        .setRunningMode(RunningMode.VIDEO).setNumPoses(2)
        .setMinPoseDetectionConfidence(0.6f).setMinPosePresenceConfidence(0.6f)
        .setMinTrackingConfidence(0.6f).build()
      val frames = mutableListOf<Pair<Long, JSONArray>>()
      val required = if (view == "side_left") listOf(11, 23, 25, 27) else listOf(12, 24, 26, 28)
      var sampled = 0; var usable = 0; var multiple = 0
      PoseLandmarker.createFromOptions(context, options).use { detector ->
        for (timestamp in 0L until duration step 100L) {
          require(!cancelled.get()) { "Processing cancelled; no result saved" }
          sampled++
          // Requested sampling timestamps are stored, not claimed to be original frame PTS.
          val decoded = retriever.getFrameAtTime(timestamp * 1000, MediaMetadataRetriever.OPTION_CLOSEST)
          if (decoded != null) {
            val scale = minOf(1.0, 768.0 / maxOf(decoded.width, decoded.height))
            val resized = if (scale < 1) Bitmap.createScaledBitmap(decoded, (decoded.width * scale).toInt(), (decoded.height * scale).toInt(), true) else decoded
            val bitmap = if (resized.config == Bitmap.Config.ARGB_8888) resized else resized.copy(Bitmap.Config.ARGB_8888, false)
            try {
              val image = BitmapImageBuilder(bitmap).build()
              try {
                val poses = detector.detectForVideo(image, timestamp).landmarks()
                if (poses.size > 1) multiple++
                if (poses.size == 1 && poses[0].size == 33) {
                  val landmarks = poses[0]
                  val good = required.all { i ->
                    val p = landmarks[i]
                    p.visibility().orElse(0f) >= .6f && p.presence().orElse(0f) >= .6f && p.x() in 0f..1f && p.y() in 0f..1f
                  }
                  if (good) usable++
                  val data = JSONArray()
                  landmarks.forEachIndexed { i, p -> data.put(JSONObject().put("index", i).put("x", p.x().toDouble()).put("y", p.y().toDouble()).put("z", p.z().toDouble()).put("visibility", p.visibility().orElse(0f).toDouble()).put("presence", p.presence().orElse(0f).toDouble())) }
                  frames.add(timestamp to data)
                }
              } finally { image.close() }
            } finally {
              if (bitmap !== resized) bitmap.recycle()
              if (resized !== decoded) resized.recycle()
              decoded.recycle()
            }
          }
          onProgress(((timestamp + 100) * 100.0 / duration).coerceAtMost(99.0))
        }
      }
      require(!cancelled.get()) { "Processing cancelled; no result saved" }
      require(sampled > 0 && multiple.toDouble() / sampled <= .05) { "More than one person detected; record alone" }
      val ratio = usable.toDouble() / sampled
      require(ratio >= .7) { "Required joints visible in fewer than 70% of sampled frames; please retake" }
      val id = UUID.randomUUID().toString()
      val summary = JSONObject().put("id", id).put("createdAt", System.currentTimeMillis())
        .put("durationMs", duration).put("sampledFrames", sampled).put("poseFrames", frames.size)
        .put("usableFrameRatio", ratio).put("view", view).put("modelSha256", hash)
        .put("extractorVersion", "android-pose-0.1.0").put("landmarkCount", 33)
        .put("rawVideoRetained", false).put("consentVersion", "local-prototype-notice-v1")
        .put("timestampMethod", "requested-100ms-nearest-decoded-frame")
      // Delete source BEFORE committing a success result; failed cleanup cannot be reported as private success.
      remove(source)
      PoseStore(context).use { store ->
        val db = store.writableDatabase
        db.beginTransaction()
        try {
          require(!cancelled.get()) { "Processing cancelled; no result saved" }
          db.insertOrThrow("sessions", null, ContentValues().apply { put("id", id); put("created", summary.getLong("createdAt")); put("summary", summary.toString()) })
          frames.forEach { (timestamp, landmarks) ->
            require(!cancelled.get()) { "Processing cancelled; no result saved" }
            db.insertOrThrow("frames", null, ContentValues().apply { put("session_id", id); put("timestamp", timestamp); put("landmarks", landmarks.toString()) })
          }
          db.setTransactionSuccessful()
        } finally { db.endTransaction() }
      }
      return summary.toString()
    } finally {
      // Native failures/cancellation clean up even if the JS screen has unmounted.
      try { retriever.release() } finally { remove(source) }
    }
  }
}
