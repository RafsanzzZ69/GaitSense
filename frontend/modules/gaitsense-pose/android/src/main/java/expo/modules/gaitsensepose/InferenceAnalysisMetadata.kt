package expo.modules.gaitsensepose

import org.json.JSONObject

/** Observe the actual bitmap submitted on EVERY inference call, including no-pose calls.
 * No frame identity, upright assertion or decoded presentation timestamp is established.
 */
internal class InferenceAnalysisMetadata {
  private var width: Int? = null
  private var height: Int? = null
  private var consistent = true
  private var calls = 0

  fun observe(inferenceWidth: Int, inferenceHeight: Int) {
    require(inferenceWidth in 1..768 && inferenceHeight in 1..768) { "Invalid inference bitmap dimensions" }
    require(calls < 160) { "Too many inference calls" }
    if (calls == 0) { width = inferenceWidth; height = inferenceHeight }
    else if (width != inferenceWidth || height != inferenceHeight) consistent = false
    calls++
  }

  fun toJson(): JSONObject {
    val geometry = JSONObject().put("observedInferenceCalls", calls)
    if (calls > 0 && consistent) {
      geometry.put("status", "available").put("source", "native-inference-bitmap")
        .put("inferenceWidth", width).put("inferenceHeight", height)
        .put("constantDimensions", true).put("scope", "all-inference-calls")
        .put("transform", JSONObject().put("resize", "fit-longest-edge-768-no-upscale")
          .put("pixelFormat", "ARGB_8888").put("applicationRotationDegrees", 0)
          .put("applicationMirror", false).put("decoderOrientation", "platform-output-not-upright-assertion"))
    } else {
      geometry.put("status", "unavailable").put("constantDimensions", false)
        .put("reason", if (calls == 0) "no-inference-calls" else "varying-inference-dimensions")
    }
    fun unassessed() = JSONObject().put("status", "unassessed").put("value", JSONObject.NULL).put("source", JSONObject.NULL)
    return JSONObject().put("contractVersion", "saved-analysis-metadata-1").put("geometry", geometry)
      .put("direction", unassessed()).put("upright", unassessed())
  }
}
