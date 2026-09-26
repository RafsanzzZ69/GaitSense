package expo.modules.gaitsensepose

import kotlin.math.hypot

/** Aggregate diagnostics only. Never merge poses or relax acceptance based on overlap. */
internal data class DiagnosticPoint(val x: Float, val y: Float, val visibility: Float, val presence: Float)
internal class PoseSampleDiagnostics {
  var sampled = 0; private set
  var multiple = 0; private set
  var noPose = 0; private set
  var overlapCandidates = 0; private set
  var firstMultipleMs = -1L; private set
  var lastMultipleMs = -1L; private set
  var longestMultipleRun = 0; private set
  private var secondStrongMin = 33
  private var secondStrongMax = 0
  private var run = 0

  fun observe(timestamp: Long, poses: List<List<DiagnosticPoint>>) {
    sampled++
    if (poses.isEmpty()) noPose++
    if (poses.size > 1) {
      multiple++; run++
      longestMultipleRun = maxOf(longestMultipleRun, run)
      if (firstMultipleMs < 0) firstMultipleMs = timestamp
      lastMultipleMs = timestamp
      val strong = poses[1].count { it.visibility >= .6f && it.presence >= .6f && it.x in 0f..1f && it.y in 0f..1f }
      secondStrongMin = minOf(secondStrongMin, strong)
      secondStrongMax = maxOf(secondStrongMax, strong)
      // Similar confident corresponding points suggest overlap, not proof of duplication.
      val distances = poses[0].zip(poses[1]).filter { (a, b) ->
        listOf(a, b).all { it.visibility >= .6f && it.presence >= .6f && it.x in 0f..1f && it.y in 0f..1f }
      }.map { (a, b) -> hypot((a.x - b.x).toDouble(), (a.y - b.y).toDouble()) }
      if (distances.size >= 4 && distances.average() <= .05) overlapCandidates++
    } else run = 0
  }

  fun singlePersonGatePasses() = sampled > 0 && multiple.toDouble() / sampled <= .05
  fun report() = "samples=$sampled; noPose=$noPose; multi=$multiple; overlapCandidates=$overlapCandidates; " +
    "firstMultiMs=$firstMultipleMs; lastMultiMs=$lastMultipleMs; longestMultiRun=$longestMultipleRun; " +
    "secondStrongJointsMin=${if (multiple == 0) 0 else secondStrongMin}; secondStrongJointsMax=$secondStrongMax"
}
