package expo.modules.gaitsensepose

import android.content.ContentValues
import android.net.Uri
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.json.JSONArray
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

@RunWith(AndroidJUnit4::class)
class OfflinePoseTest {
  private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
  private val context get() = instrumentation.targetContext

  @Before fun isolatedStore() {
    // Tests must never delete data from the installed user application.
    check(context.packageName != "com.gaitsense.research")
    context.deleteDatabase("gaitsense-offline.db")
  }
  private fun clip(name: String): File {
    val file = File(context.cacheDir, "Camera/$name")
    file.parentFile!!.mkdirs()
    instrumentation.context.assets.open(name).use { input -> file.outputStream().use { input.copyTo(it) } }
    return file
  }
  private fun count(table: String): Int = PoseStore(context).use { store ->
    store.readableDatabase.rawQuery("SELECT COUNT(*) FROM $table", null).use { c -> c.moveToFirst(); c.getInt(0) }
  }
  private fun expectFailure(body: () -> Unit): Exception {
    try { body() } catch (e: Exception) { return e }
    throw AssertionError("Expected rejection")
  }
  @Test fun realVideoInferencePersistsReopensAndDeletes() {
    // Keep walking.MOV unchanged for the historical short-interval/negative tests.
    val arguments = InstrumentationRegistry.getArguments()
    val fixture = arguments.getString("fixture") ?: "full-duration.MOV"
    val view = arguments.getString("view") ?: "side_right"
    val file = clip(fixture)
    val progress = mutableListOf<Double>()
    val start = System.currentTimeMillis()
    val raw = OfflinePoseProcessor(context, AtomicBoolean(false)) { progress.add(it) }
      .process(Uri.fromFile(file).toString(), view, true)
    val result = JSONObject(raw)
    assertEquals(33, result.getInt("landmarkCount"))
    assertTrue(result.getDouble("usableFrameRatio") >= .7)
    assertFalse(result.getBoolean("rawVideoRetained"))
    assertFalse(file.exists())
    assertTrue(progress.isNotEmpty())
    assertEquals(1, count("sessions"))
    assertEquals(result.getInt("poseFrames"), count("frames"))
    // Each helper opens and closes a real Android SQLite connection.
    PoseStore(context).use { store ->
      store.readableDatabase.rawQuery("SELECT summary FROM sessions WHERE id=?", arrayOf(result.getString("id"))).use { c ->
        assertTrue(c.moveToFirst()); assertEquals(raw, c.getString(0))
      }
      store.readableDatabase.rawQuery("SELECT timestamp,landmarks FROM frames WHERE session_id=? ORDER BY timestamp", arrayOf(result.getString("id"))).use { c ->
        var inspected = 0
        var previous = -1L
        while (c.moveToNext()) {
          assertTrue(c.getLong(0) > previous); previous = c.getLong(0)
          val points = JSONArray(c.getString(1))
          assertEquals(33, points.length())
          for (i in 0 until 33) {
            val point = points.getJSONObject(i)
            assertEquals(i, point.getInt("index"))
            for (key in listOf("x", "y", "z", "visibility", "presence")) assertTrue(point.getDouble(key).isFinite())
          }
          inspected++
        }
        assertEquals(result.getInt("poseFrames"), inspected)
      }
      store.writableDatabase.delete("sessions", "id=?", arrayOf(result.getString("id")))
    }
    assertEquals(0, count("frames"))
    assertEquals(0, count("sessions"))
    println("GAITSENSE_NATIVE_RESULT fixture=$fixture view=$view durationMs=${result.getLong("durationMs")} sampled=${result.getInt("sampledFrames")} frames=${result.getInt("poseFrames")} usable=${result.getDouble("usableFrameRatio")} elapsedMs=${System.currentTimeMillis()-start}")
  }
  @Test fun cancellationSavesNothing() {
    val file = clip("walking.MOV")
    try {
      val failure = expectFailure { OfflinePoseProcessor(context, AtomicBoolean(true)) {}
        .process(Uri.fromFile(file).toString(), "side_left", true) }
      assertTrue(failure.message!!.contains("cancelled"))
      assertFalse(file.exists())
      assertEquals(0, count("sessions")); assertEquals(0, count("frames"))
    } finally { file.delete() }
  }
  @Test fun shortClipSavesNothing() {
    val file = clip("short.MOV")
    try {
      val failure = expectFailure { OfflinePoseProcessor(context, AtomicBoolean(false)) {}
        .process(Uri.fromFile(file).toString(), "side_left", true) }
      assertTrue(failure.message!!.contains("10-15"))
      assertFalse(file.exists())
      assertEquals(0, count("sessions"))
    } finally { file.delete() }
  }
  @Test fun consentAndPathBoundaries() {
    val engine = OfflinePoseProcessor(context, AtomicBoolean(false)) {}
    assertTrue(expectFailure { engine.process("file:///outside.mp4", "side_left", false) }.message!!.contains("notice"))
    assertTrue(expectFailure { engine.process("file:///outside.mp4", "side_left", true) }.message!!.contains("Camera cache"))
    assertTrue(expectFailure { engine.process("https://example.com/file.mp4", "side_left", true) }.message!!.contains("app-local"))
    assertEquals(0, count("sessions"))
  }
  @Test fun transactionRollbackAndForeignKeys() {
    PoseStore(context).use { store ->
      val db = store.writableDatabase
      db.beginTransaction()
      try {
        db.insertOrThrow("sessions", null, ContentValues().apply { put("id", "test"); put("created", 1); put("summary", "{}") })
        db.insertOrThrow("frames", null, ContentValues().apply { put("session_id", "test"); put("timestamp", 0); put("landmarks", "[]") })
      } finally { db.endTransaction() }
      expectFailure { db.insertOrThrow("frames", null, ContentValues().apply { put("session_id", "missing"); put("timestamp", 0); put("landmarks", "[]") }); Unit }
    }
    assertEquals(0, count("sessions")); assertEquals(0, count("frames"))
  }
}
