package expo.modules.gaitsensepose

import com.google.mediapipe.tasks.components.containers.NormalizedLandmark
import java.util.Optional
import org.junit.Assert.*
import org.junit.Test

class RequiredJointQualityGateTest {
  private fun pose() = MutableList(33) { DiagnosticPoint(.5f, .5f, .9f, .9f) }
  private fun check(index: Int, point: DiagnosticPoint): RequiredJointQualityGate {
    val points = pose(); points[index] = point
    return RequiredJointQualityGate("side_left").also { it.observe(listOf(points)) }
  }
  @Test fun leftMapping() { assertEquals(listOf(11, 23, 25, 27), RequiredJointQualityGate("side_left").required) }
  @Test fun rightMapping() { assertEquals(listOf(12, 24, 26, 28), RequiredJointQualityGate("side_right").required) }
  @Test fun sidesDiffer() { assertNotEquals(RequiredJointQualityGate("side_left").required, RequiredJointQualityGate("side_right").required) }
  @Test fun unknownSideHasNoDefault() {
    try { RequiredJointQualityGate("unknown"); fail("Unknown side must fail") } catch (_: IllegalStateException) {}
  }
  @Test fun highQualitySelectedSidePasses() {
    val gate = RequiredJointQualityGate("side_left")
    assertTrue(gate.observe(listOf(pose()))); assertEquals(1, gate.usable); assertEquals(1, gate.poseFrames)
  }
  @Test fun hiddenOppositeSideDoesNotRejectLeft() {
    val points = pose(); listOf(12, 24, 26, 28).forEach { points[it] = DiagnosticPoint(-1f, 2f, .1f, .1f) }
    assertTrue(RequiredJointQualityGate("side_left").observe(listOf(points)))
    assertFalse(RequiredJointQualityGate("side_right").observe(listOf(points)))
  }
  @Test fun hiddenOppositeSideDoesNotRejectRight() {
    val points = pose(); listOf(11, 23, 25, 27).forEach { points[it] = DiagnosticPoint(-1f, 2f, .1f, .1f) }
    assertTrue(RequiredJointQualityGate("side_right").observe(listOf(points)))
    assertFalse(RequiredJointQualityGate("side_left").observe(listOf(points)))
  }
  @Test fun eachRequiredJointRejectsLowVisibility() {
    for (index in listOf(11, 23, 25, 27)) {
      val gate = check(index, DiagnosticPoint(.5f, .5f, .599f, .9f))
      assertEquals(0, gate.usable); assertTrue(gate.report().contains("$index:lowVisibility=1"))
    }
  }
  @Test fun lowPresenceRejects() {
    val gate = check(25, DiagnosticPoint(.5f, .5f, .9f, .599f))
    assertEquals(0, gate.usable); assertTrue(gate.report().contains("25:lowPresence=1"))
  }
  @Test fun outsideEachBoundRejects() {
    for ((x, y) in listOf(-.001f to .5f, 1.001f to .5f, .5f to -.001f, .5f to 1.001f)) {
      val gate = check(27, DiagnosticPoint(x, y, .9f, .9f))
      assertEquals(0, gate.usable); assertTrue(gate.report().contains("27:outOfFrame=1"))
    }
  }
  @Test fun exactConfidenceAndCoordinateBoundariesPass() {
    for ((x, y) in listOf(0f to 0f, 1f to 1f)) assertEquals(1, check(11, DiagnosticPoint(x, y, .6f, .6f)).usable)
  }
  @Test fun shoulderRemainsRequired() { assertEquals(0, check(11, DiagnosticPoint(.5f, .5f, .1f, .9f)).usable) }
  @Test fun heelAndFootIndexAreNotRequired() {
    val points = pose(); listOf(29, 30, 31, 32).forEach { points[it] = DiagnosticPoint(-1f, -1f, 0f, 0f) }
    assertTrue(RequiredJointQualityGate("side_left").observe(listOf(points)))
  }
  @Test fun actualMediaPipeOptionalsPreserveMissingVersusZero() {
    val missing = DiagnosticPoint.fromLandmark(NormalizedLandmark.create(.5f, .5f, 0f))
    assertFalse(missing.visibilityPresent); assertFalse(missing.presencePresent)
    val gate = check(27, missing); assertEquals(0, gate.usable)
    assertTrue(gate.report().contains("missingVisibility=1,lowPresence=0,missingPresence=1"))
    val zero = DiagnosticPoint.fromLandmark(NormalizedLandmark.create(.5f, .5f, 0f, Optional.of(0f), Optional.of(0f)))
    assertTrue(zero.visibilityPresent); assertTrue(zero.presencePresent)
    assertTrue(check(27, zero).report().contains("lowVisibility=1,missingVisibility=0,lowPresence=1,missingPresence=0"))
  }
  @Test fun actualMediaPipeConfidenceHasNoSerializationRoundingBeforeGate() {
    val point = DiagnosticPoint.fromLandmark(NormalizedLandmark.create(.5f, .5f, 0f, Optional.of(.599999f), Optional.of(.6f)))
    assertEquals(0, check(23, point).usable)
  }
  @Test fun nonFiniteValuesFailOriginalComparisons() {
    assertEquals(0, check(27, DiagnosticPoint(Float.NaN, .5f, .9f, .9f)).usable)
    assertEquals(0, check(27, DiagnosticPoint(.5f, .5f, Float.NaN, .9f)).usable)
    assertEquals(0, check(27, DiagnosticPoint(.5f, .5f, .9f, Float.NaN)).usable)
  }
  @Test fun poseFrameExistsWhileUnusable() {
    val gate = check(25, DiagnosticPoint(.5f, .5f, .1f, .9f))
    assertEquals(1, gate.poseFrames); assertEquals(0, gate.usable); assertEquals(1, gate.jointRejected)
  }
  @Test fun allRequiredJointsMustPassOnSameSample() {
    val gate = RequiredJointQualityGate("side_left")
    for (index in listOf(11, 23, 25, 27)) {
      val points = pose(); points[index] = DiagnosticPoint(.5f, .5f, .1f, .9f); gate.observe(listOf(points))
    }
    assertEquals(4, gate.poseFrames); assertEquals(0, gate.usable)
  }
  @Test fun structuralFailuresRemainInDenominator() {
    val gate = RequiredJointQualityGate("side_left")
    gate.observe(emptyList()); gate.observe(listOf(pose(), pose())); gate.observe(listOf(pose().take(27))); gate.observe(listOf(pose()))
    assertEquals(4, gate.sampled); assertEquals(1, gate.usable); assertEquals(1, gate.poseFrames)
    assertEquals(1, gate.noPose); assertEquals(1, gate.multiple); assertEquals(1, gate.invalidLandmarkCount)
    assertEquals(.25, gate.usableRatio, 0.0); assertFalse(gate.passes())
  }
  @Test fun emptyRecordingFails() { assertFalse(RequiredJointQualityGate("side_left").passes()) }
  @Test fun missingRequiredLandmarkIsSubsetOfInvalidCount() {
    val gate = RequiredJointQualityGate("side_left")
    gate.observe(listOf(pose().take(27))) // selected ankle missing
    gate.observe(listOf(pose().take(32))) // all four required joints exist, but contract still requires 33
    assertEquals(2, gate.invalidLandmarkCount); assertEquals(1, gate.missingRequiredLandmark)
    assertEquals(0, gate.poseFrames); assertEquals(0, gate.usable)
  }
  @Test fun exactlySeventyPercentPassesAndSixtyNinePointNineFails() {
    for ((good, expected) in listOf(700 to true, 699 to false)) {
      val gate = RequiredJointQualityGate("side_left")
      repeat(good) { gate.observe(listOf(pose())) }; repeat(1000 - good) { gate.observe(emptyList()) }
      assertEquals(expected, gate.passes()); assertEquals(good / 1000.0, gate.usableRatio, 0.0)
    }
  }
  @Test fun seventhAttemptCounterBoundarySyntheticOnly() {
    for ((good, expected) in listOf(88 to false, 91 to false, 92 to true)) {
      val gate = RequiredJointQualityGate("side_left")
      repeat(good) { gate.observe(listOf(pose())) }
      repeat(131 - good) { val points = pose(); points[27] = DiagnosticPoint(.5f, .5f, .1f, .9f); gate.observe(listOf(points)) }
      assertEquals(131, gate.poseFrames); assertEquals(good, gate.usable); assertEquals(131 - good, gate.jointRejected)
      assertEquals(expected, gate.passes())
      // This chosen synthetic ankle failure is NOT evidence about the user's recording.
      if (good == 88) assertTrue(gate.report().contains("firstFailureExclusive=27:lowVisibility=43"))
    }
  }
  @Test fun earlierAttemptCountersSyntheticOnly() {
    val gate = RequiredJointQualityGate("side_right")
    repeat(39) { gate.observe(listOf(pose())) }
    repeat(84) { val points = pose(); points[24] = DiagnosticPoint(.5f, .5f, .9f, .1f); gate.observe(listOf(points)) }
    assertEquals(123, gate.poseFrames); assertEquals(39, gate.usable); assertEquals(84, gate.jointRejected)
    assertFalse(gate.passes()); assertTrue(gate.report().contains("firstFailureExclusive=24:lowPresence=84"))
  }
  @Test fun exclusiveAttributionAndOverlappingReasonsHaveDifferentDenominators() {
    val points = pose(); points[11] = DiagnosticPoint(-1f, .5f, .1f, .1f); points[27] = DiagnosticPoint(.5f, .5f, .1f, .9f)
    val gate = RequiredJointQualityGate("side_left"); gate.observe(listOf(points))
    assertEquals(1, gate.jointRejected)
    assertTrue(gate.report().contains("firstFailureExclusive=11:lowVisibility=1;"))
    assertTrue(gate.report().contains("11/shoulder:failed=1,lowVisibility=1,missingVisibility=0,lowPresence=1,missingPresence=0,outOfFrame=1"))
    assertTrue(gate.report().contains("27/ankle:failed=1,lowVisibility=1"))
  }
}
