package expo.modules.gaitsensepose

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class RecordingAnalysisSetupTest {
  private fun raw(direction: String = "1", upright: String = "true") =
    """{"contractVersion":"recording-analysis-setup-1","direction":$direction,"upright":$upright}"""
  private fun metadata(raw: String): JSONObject {
    val setup = RecordingAnalysisSetup.fromJson(raw)
    val collector = InferenceAnalysisMetadata()
    repeat(100) { collector.observe(768, 432) }
    return JSONObject(collector.toJson(setup).toString())
  }
  private fun same(expected: JSONObject, actual: JSONObject) {
    assertEquals(expected.keys().asSequence().toSet(), actual.keys().asSequence().toSet())
    expected.keys().forEach { key ->
      val e=expected.get(key); val a=actual.get(key)
      if(e is JSONObject) same(e,a as JSONObject)
      else if(e is Number) assertEquals(e.toDouble(),(a as Number).toDouble(),0.0)
      else assertEquals(e,a)
    }
  }
  @Test fun rightAndUprightMatchIndependentV2Fixture() {
    same(JSONObject(javaClass.getResource("/analysis-metadata-v2.json")!!.readText()), metadata(raw()))
  }
  @Test fun leftDirectionKeepsGeometryNative() {
    val m=metadata(raw("-1"))
    assertEquals(-1,m.getJSONObject("direction").getInt("value"))
    assertEquals("operator-recording-setup",m.getJSONObject("direction").getString("source"))
    assertEquals("native-inference-bitmap",m.getJSONObject("geometry").getString("source"))
  }
  @Test fun unassessedIsNullNotFalseOrZero() {
    val m=metadata(raw("null","null"))
    assertEquals("saved-analysis-metadata-2",m.getString("contractVersion"))
    for(key in listOf("direction","upright")) {
      val a=m.getJSONObject(key); assertEquals("unassessed",a.getString("status"))
      assertTrue(a.isNull("value")); assertTrue(a.isNull("source"))
    }
  }
  @Test fun malformedAssertionsFailBeforeProcessing() {
    for(bad in listOf(raw("0"),raw("2"),raw("1.1"),raw("\"1\""),raw("true"),raw("1","false"),raw("1","1"),raw("1","\"true\""),"{}","[]",raw().replace("setup-1","setup-99"))) {
      try { RecordingAnalysisSetup.fromJson(bad); fail("Accepted $bad") } catch(_:Exception) { }
    }
  }
  @Test fun immutableSetupAndIndependentRequestsCannotLeak() {
    val first=RecordingAnalysisSetup.fromJson(raw("-1"))
    first.directionJson().put("value",1)
    assertEquals(-1,first.directionJson().getInt("value"))
    val second=RecordingAnalysisSetup.fromJson(raw("null","null"))
    assertTrue(second.directionJson().isNull("value")); assertTrue(second.uprightJson().isNull("value"))
  }
  @Test fun assertionsCannotReplaceGeometryOrDecoderProvenance() {
    val m=metadata(raw().dropLast(1)+""", "geometry":{"inferenceWidth":1}, "rotation":90, "side":"side_right"}""")
    assertEquals(768,m.getJSONObject("geometry").getInt("inferenceWidth"))
    assertEquals(0,m.getJSONObject("geometry").getJSONObject("transform").getInt("applicationRotationDegrees"))
  }
}
