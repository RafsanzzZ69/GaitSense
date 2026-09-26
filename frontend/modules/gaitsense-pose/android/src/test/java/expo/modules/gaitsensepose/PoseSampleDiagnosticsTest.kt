package expo.modules.gaitsensepose

import org.junit.Assert.*
import org.junit.Test

class PoseSampleDiagnosticsTest {
  private fun pose(x: Float, confidence: Float = .9f) = List(33) { DiagnosticPoint(x, .5f, confidence, confidence) }
  @Test fun fivePercentBoundaryIsUnchanged() {
    val stats = PoseSampleDiagnostics()
    stats.observe(0, listOf(pose(.2f), pose(.8f)))
    repeat(19) { stats.observe((it + 1) * 100L, listOf(pose(.2f))) }
    assertTrue(stats.singlePersonGatePasses())
    stats.observe(2000, listOf(pose(.2f), pose(.8f)))
    assertFalse(stats.singlePersonGatePasses())
  }
  @Test fun overlappingCandidatesStillFailSinglePersonGate() {
    val stats = PoseSampleDiagnostics()
    repeat(10) { stats.observe(it * 100L, listOf(pose(.2f), pose(.21f))) }
    assertEquals(10, stats.overlapCandidates)
    assertEquals(10, stats.multiple)
    assertFalse(stats.singlePersonGatePasses())
  }
  @Test fun distinctAndLowConfidencePosesAreNotCalledOverlap() {
    val stats = PoseSampleDiagnostics()
    stats.observe(0, listOf(pose(.2f), pose(.8f)))
    stats.observe(100, listOf(pose(.2f), pose(.2f, .1f)))
    assertEquals(0, stats.overlapCandidates)
    assertEquals(2, stats.multiple)
  }
  @Test fun gapsResetRunAndRemainInDenominator() {
    val stats = PoseSampleDiagnostics()
    assertFalse(stats.singlePersonGatePasses())
    stats.observe(0, listOf(pose(.2f), pose(.8f)))
    stats.observe(100, emptyList())
    stats.observe(200, listOf(pose(.2f), pose(.8f)))
    assertEquals(3, stats.sampled)
    assertEquals(1, stats.noPose)
    assertEquals(1, stats.longestMultipleRun)
    assertEquals(0L, stats.firstMultipleMs)
    assertEquals(200L, stats.lastMultipleMs)
  }
}
