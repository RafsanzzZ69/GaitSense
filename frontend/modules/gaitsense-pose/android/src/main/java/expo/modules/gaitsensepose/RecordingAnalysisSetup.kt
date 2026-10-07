package expo.modules.gaitsensepose

import org.json.JSONObject

/** Immutable operator assertions for one process request; never inferred from camera/decoder. */
internal class RecordingAnalysisSetup private constructor(private val direction: Int?, private val upright: Boolean?) {
  companion object {
    fun fromJson(raw: String): RecordingAnalysisSetup {
      require(raw.length <= 1024) { "Recording setup is too large" }
      val json = JSONObject(raw)
      require(json.getString("contractVersion") == "recording-analysis-setup-1") { "Unknown recording setup version" }
      require(json.has("direction") && json.has("upright")) { "Missing recording setup fields" }
      val d = json.get("direction"); val u = json.get("upright")
      require(d === JSONObject.NULL || d is Number && d.toDouble() in listOf(-1.0, 1.0)) { "Invalid image-x direction" }
      require(u === JSONObject.NULL || u == true) { "Invalid upright image assertion" }
      return RecordingAnalysisSetup(if (d === JSONObject.NULL) null else (d as Number).toInt(), if (u === JSONObject.NULL) null else true)
    }
  }
  fun directionJson(): JSONObject = assertion(direction)
  fun uprightJson(): JSONObject = assertion(upright)
  private fun assertion(value: Any?): JSONObject = if (value == null)
    JSONObject().put("status", "unassessed").put("value", JSONObject.NULL).put("source", JSONObject.NULL)
  else JSONObject().put("status", "asserted").put("value", value).put("source", "operator-recording-setup")
}
