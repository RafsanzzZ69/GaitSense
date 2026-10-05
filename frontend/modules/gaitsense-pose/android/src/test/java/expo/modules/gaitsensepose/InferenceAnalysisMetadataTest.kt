package expo.modules.gaitsensepose

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class InferenceAnalysisMetadataTest {
  private fun sameFields(expected: JSONObject, actual: JSONObject) {
    assertEquals(expected.keys().asSequence().toSet(), actual.keys().asSequence().toSet())
    expected.keys().forEach { key ->
      val e = expected.get(key); val a = actual.get(key)
      if (e is JSONObject) sameFields(e, a as JSONObject)
      else if (e is Number) assertEquals(e.toDouble(), (a as Number).toDouble(), 0.0)
      else assertEquals(e, a)
    }
  }
  @Test fun actualSerializerMatchesIndependentCrossLanguageFixture() {
    val metadata = InferenceAnalysisMetadata()
    repeat(100) { metadata.observe(768, 432) }
    val expected = JSONObject(javaClass.getResource("/analysis-metadata-v1.json")!!.readText())
    sameFields(expected, JSONObject(metadata.toJson().toString()))
  }
  @Test fun noCallsCannotAssertGeometry() {
    val g = InferenceAnalysisMetadata().toJson().getJSONObject("geometry")
    assertEquals("no-inference-calls", g.getString("reason"))
    assertFalse(g.getBoolean("constantDimensions"))
    assertFalse(g.has("inferenceWidth"))
  }
  @Test fun varyingDimensionsRemainUnavailableEvenIfTheyReturnToOriginal() {
    val m = InferenceAnalysisMetadata()
    m.observe(768, 432); m.observe(432, 768); m.observe(768, 432)
    val g = m.toJson().getJSONObject("geometry")
    assertEquals("varying-inference-dimensions", g.getString("reason"))
    assertEquals(3, g.getInt("observedInferenceCalls")); assertFalse(g.has("inferenceWidth"))
  }
  @Test fun heightOnlyVariationIsDetected() {
    val m = InferenceAnalysisMetadata(); m.observe(768, 432); m.observe(768, 431)
    assertEquals("unavailable", m.toJson().getJSONObject("geometry").getString("status"))
  }
  @Test fun invalidDimensionsCannotEnterSerialization() {
    for (dimensions in listOf(0 to 432, 768 to 0, -1 to 432, 768 to -1, Int.MAX_VALUE to 432, 768 to Int.MAX_VALUE)) {
      try { InferenceAnalysisMetadata().observe(dimensions.first, dimensions.second); fail("Accepted invalid dimension") }
      catch (_: IllegalArgumentException) { }
    }
  }
  @Test fun observationLimitIsBounded() {
    val m = InferenceAnalysisMetadata(); repeat(160) { m.observe(768, 432) }
    try { m.observe(768, 432); fail("Accepted too many calls") } catch (_: IllegalArgumentException) { }
  }
  @Test fun assertionsRemainUnassessedAndSnapshotsAreDetached() {
    val m = InferenceAnalysisMetadata(); m.observe(432, 768)
    val first = m.toJson(); first.getJSONObject("geometry").put("inferenceWidth", 1)
    val next = m.toJson()
    assertEquals(432, next.getJSONObject("geometry").getInt("inferenceWidth"))
    for (key in listOf("direction", "upright")) {
      val assertion = next.getJSONObject(key)
      assertEquals("unassessed", assertion.getString("status")); assertTrue(assertion.isNull("value")); assertTrue(assertion.isNull("source"))
    }
  }
}
