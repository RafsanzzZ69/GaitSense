package expo.modules.gaitsensepose

/** Existing capture gate with local, bounded diagnostics. No setup/rotation inference. */
internal class RequiredJointQualityGate(private val view: String) {
  val required: List<Int> = when (view) {
    "side_left" -> listOf(11, 23, 25, 27)
    "side_right" -> listOf(12, 24, 26, 28)
    else -> error("Choose the visible side")
  }
  var sampled = 0; private set
  var usable = 0; private set
  var poseFrames = 0; private set
  var noPose = 0; private set
  var multiple = 0; private set
  var invalidLandmarkCount = 0; private set
  var missingRequiredLandmark = 0; private set
  var jointRejected = 0; private set
  // Each rejected 33-point sample gets ONE first failure; all failures also count below.
  // First means required-index order, then visibility, presence, bounds. Not sole cause.
  private val firstFailures = linkedMapOf<String, Int>()
  private val allFailures = required.associateWith { linkedMapOf<String, Int>() }
  private val jointFailures = required.associateWith { 0 }.toMutableMap()
  val usableRatio get() = if (sampled == 0) 0.0 else usable.toDouble() / sampled
  fun passes() = sampled > 0 && usableRatio >= .7

  fun observe(poses: List<List<DiagnosticPoint>>): Boolean {
    sampled++
    if (poses.isEmpty()) { noPose++; return false }
    if (poses.size != 1) { multiple++; return false }
    val points = poses.single()
    if (points.size != 33) {
      invalidLandmarkCount++
      if (required.any { it >= points.size }) missingRequiredLandmark++
      return false
    }
    poseFrames++
    var first: String? = null
    required.forEach { index ->
      val p = points[index]
      val reasons = mutableListOf<String>()
      // Absent Optional values still fail as zero, as before. Availability is diagnostic only.
      if (!((if (p.visibilityPresent) p.visibility else 0f) >= .6f))
        reasons.add(if (p.visibilityPresent) "lowVisibility" else "missingVisibility")
      if (!((if (p.presencePresent) p.presence else 0f) >= .6f))
        reasons.add(if (p.presencePresent) "lowPresence" else "missingPresence")
      if (!(p.x in 0f..1f && p.y in 0f..1f)) reasons.add("outOfFrame")
      if (reasons.isNotEmpty()) {
        jointFailures[index] = jointFailures.getValue(index) + 1
        reasons.forEach { reason ->
          val counts = allFailures.getValue(index)
          counts[reason] = (counts[reason] ?: 0) + 1
        }
        if (first == null) first = "$index:${reasons.first()}"
      }
    }
    if (first == null) { usable++; return true }
    jointRejected++
    firstFailures[first!!] = (firstFailures[first!!] ?: 0) + 1
    return false
  }

  fun report(): String {
    val names = listOf("shoulder", "hip", "knee", "ankle")
    val perJoint = required.mapIndexed { n, index ->
      val counts = allFailures.getValue(index)
      "$index/${names[n]}:failed=${jointFailures.getValue(index)}," +
        listOf("lowVisibility", "missingVisibility", "lowPresence", "missingPresence", "outOfFrame")
          .joinToString(",") { "$it=${counts[it] ?: 0}" }
    }.joinToString(" | ")
    return "qualityGate=required-joint-1; view=$view; required=${required.joinToString(",")}; " +
      "visibilityMin=0.6; presenceMin=0.6; bounds=0..1; usableMin=0.7; " +
      "qualitySamples=$sampled; qualityPoseFrames=$poseFrames; rejected=${sampled - usable}; " +
      "qualityNoPose=$noPose; qualityMulti=$multiple; invalidLandmarkCount=$invalidLandmarkCount; missingRequiredLandmark=$missingRequiredLandmark; " +
      "jointRejected=$jointRejected; firstFailureExclusive=${firstFailures.entries.joinToString(",") { "${it.key}=${it.value}" }.ifEmpty { "none" }}; " +
      "jointFailuresOverlapping=[$perJoint]"
  }
}
