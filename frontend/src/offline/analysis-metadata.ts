/** Structured storage evidence, not scientific validation or image authentication. */
export const ANALYSIS_METADATA_VERSION = 'saved-analysis-metadata-1';
export const ANALYSIS_METADATA_V2 = 'saved-analysis-metadata-2';
export const OPERATOR_ASSERTION_SOURCE = 'operator-recording-setup';
export type NativeInferenceGeometry = {
  inferenceWidth: number; inferenceHeight: number;
  source: 'native-inference-bitmap'; constantDimensions: true;
  observedInferenceCalls: number; scope: 'all-inference-calls';
  transform: {
    resize: 'fit-longest-edge-768-no-upscale'; pixelFormat: 'ARGB_8888';
    applicationRotationDegrees: 0; applicationMirror: false;
    decoderOrientation: 'platform-output-not-upright-assertion';
  };
};
type Unassessed = {status: 'unassessed'; value: null; source: null};
type Assertion<T> = Unassessed | {status:'asserted'; value:T; source:typeof OPERATOR_ASSERTION_SOURCE};
export type StoredAnalysisMetadata = {
  contractVersion: typeof ANALYSIS_METADATA_VERSION | typeof ANALYSIS_METADATA_V2;
  geometry: ({status: 'available'} & NativeInferenceGeometry) | {
    status: 'unavailable'; reason: 'no-inference-calls' | 'varying-inference-dimensions';
    observedInferenceCalls: number; constantDimensions: false;
  };
  direction: Assertion<1|-1>; upright: Assertion<true>;
};
export type GeometryUnavailableReason = 'geometry_conflict' | 'invalid_analysis_metadata'
  | 'unsupported_analysis_metadata_version' | 'varying_inference_dimensions' | 'no_inference_calls';
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const calls = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 160;
const dimension = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v > 0 && v <= 768;
export function isNativeInferenceGeometry(v: unknown): v is NativeInferenceGeometry {
  if (!object(v) || !object(v.transform)) return false;
  const t=v.transform;
  return dimension(v.inferenceWidth) && dimension(v.inferenceHeight) && v.source === 'native-inference-bitmap'
    && v.constantDimensions === true && calls(v.observedInferenceCalls) && (v.observedInferenceCalls as number) > 0
    && v.scope === 'all-inference-calls' && t.resize === 'fit-longest-edge-768-no-upscale'
    && t.pixelFormat === 'ARGB_8888' && t.applicationRotationDegrees === 0 && t.applicationMirror === false
    && t.decoderOrientation === 'platform-output-not-upright-assertion';
}
/** Optional metadata is assessed separately so bad/new metadata cannot break History. */
export function readAnalysisMetadata(value: unknown):
  {status: 'absent'; metadata: null; reason: null} |
  {status: 'unavailable'; metadata: null; reason: GeometryUnavailableReason} |
  {status: 'recognized'; metadata: StoredAnalysisMetadata; reason: null} {
  if (value === undefined) return {status:'absent',metadata:null,reason:null};
  const bad = (reason: GeometryUnavailableReason) => ({status:'unavailable' as const,metadata:null,reason});
  if (!object(value) || typeof value.contractVersion !== 'string') return bad('invalid_analysis_metadata');
  if (value.contractVersion !== ANALYSIS_METADATA_VERSION && value.contractVersion !== ANALYSIS_METADATA_V2) return bad('unsupported_analysis_metadata_version');
  const unassessed = (v: unknown) => object(v) && v.status === 'unassessed' && v.value === null && v.source === null;
  const asserted = (v: unknown, validValue: (x:unknown)=>boolean) => value.contractVersion === ANALYSIS_METADATA_V2 && object(v)
    && v.status === 'asserted' && v.source === OPERATOR_ASSERTION_SOURCE && validValue(v.value);
  if (!(unassessed(value.direction) || asserted(value.direction, x=>x===1 || x===-1))
    || !(unassessed(value.upright) || asserted(value.upright, x=>x===true)) || !object(value.geometry)) return bad('invalid_analysis_metadata');
  const direction: Assertion<1|-1> = unassessed(value.direction) ? {status:'unassessed',value:null,source:null}
    : {status:'asserted',value:(value.direction as {value:1|-1}).value,source:OPERATOR_ASSERTION_SOURCE};
  const upright: Assertion<true> = unassessed(value.upright) ? {status:'unassessed',value:null,source:null}
    : {status:'asserted',value:true,source:OPERATOR_ASSERTION_SOURCE};
  const contractVersion = value.contractVersion;
  const g=value.geometry;
  if (g.status === 'available') {
    if (!isNativeInferenceGeometry(g)) return bad('invalid_analysis_metadata');
    // Copy only recognized evidence; never forward arbitrary metadata extras.
    return {status:'recognized',reason:null,metadata:{contractVersion,
      geometry:{status:'available',inferenceWidth:g.inferenceWidth,inferenceHeight:g.inferenceHeight,
        source:g.source,constantDimensions:g.constantDimensions,observedInferenceCalls:g.observedInferenceCalls,
        scope:g.scope,transform:{resize:g.transform.resize,pixelFormat:g.transform.pixelFormat,
          applicationRotationDegrees:g.transform.applicationRotationDegrees,applicationMirror:g.transform.applicationMirror,
          decoderOrientation:g.transform.decoderOrientation}},
      direction,upright}};
  }
  if (g.status !== 'unavailable' || g.constantDimensions !== false || !calls(g.observedInferenceCalls)
    || !(g.reason === 'no-inference-calls' && g.observedInferenceCalls === 0
      || g.reason === 'varying-inference-dimensions' && (g.observedInferenceCalls as number) >= 2)) return bad('invalid_analysis_metadata');
  return {status:'recognized',reason:null,metadata:{contractVersion,
    geometry:{status:'unavailable',constantDimensions:false,observedInferenceCalls:g.observedInferenceCalls as number,reason:g.reason},
    direction,upright}};
}
