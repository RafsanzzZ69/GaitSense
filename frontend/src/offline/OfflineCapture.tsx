import { CameraView, useCameraPermissions } from 'expo-camera';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Pose from '../../modules/gaitsense-pose';
import { canProcess, canRecord, parseFrames, parseSession } from './contract';
import type { CapturePhase, PoseFrame, Session, SideView } from './contract';

function Preview({ uri }: {uri: string}) {
  const player = useVideoPlayer(uri);
  return <VideoView player={player} style={styles.camera} nativeControls contentFit="contain" />;
}
function Action({label,onPress,disabled=false}: {label:string; onPress:()=>void; disabled?:boolean}) {
  return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={[styles.button,disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}
export default function OfflineCapture() {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase,setPhase] = useState<CapturePhase>('ready');
  const [consent,setConsent] = useState(false);
  const [ready,setReady] = useState(false);
  const [view,setView] = useState<SideView>('side_left');
  const [uri,setUri] = useState<string|null>(null);
  const [seconds,setSeconds] = useState(0);
  const [countdown,setCountdown] = useState(3);
  const [progress,setProgress] = useState(0);
  const [error,setError] = useState('');
  const [sessions,setSessions] = useState<Session[]>([]);
  const [frames,setFrames] = useState<PoseFrame[]>([]);
  const [frameIndex,setFrameIndex] = useState(0);
  const camera = useRef<CameraView>(null);
  const mounted = useRef(true);
  const interrupted = useRef(false);
  const locked = useRef(false);
  const uriRef = useRef<string|null>(null);
  const phaseRef = useRef<CapturePhase>('ready');
  phaseRef.current = phase;
  const storeUri = (value:string|null) => { uriRef.current=value; if (mounted.current) setUri(value); };
  const reportError = (cause:unknown) => { if (mounted.current) setError(cause instanceof Error ? cause.message : String(cause)); };
  const refresh = async () => {
    if (!Pose) return;
    const rows: unknown = JSON.parse(await Pose.listSessions());
    if (!Array.isArray(rows)) throw new Error('Cannot read local history.');
    const validated=rows.map(row=>parseSession(JSON.stringify(row)));
    if (mounted.current) setSessions(validated);
  };
  useEffect(()=>{
    mounted.current=true;
    void refresh().catch(reportError);
    const progressSub = Pose?.addListener('onProgress', e=>{ if(mounted.current) setProgress(Math.round(e.percent)); });
    const stateSub=AppState.addEventListener('change', state=>{
      if(state !== 'active') {
        interrupted.current=true;
        if(phaseRef.current==='recording') camera.current?.stopRecording();
        Pose?.cancel();
      }
    });
    return ()=>{
      mounted.current=false; interrupted.current=true;
      camera.current?.stopRecording(); Pose?.cancel();
      progressSub?.remove(); stateSub.remove();
      const pending=uriRef.current;
      if(pending && phaseRef.current!=='processing') void Pose?.discardVideo(pending).catch(()=>{});
    };
  },[]);
  useEffect(()=>{
    if(phase!=='recording') return;
    const timer=setInterval(()=>setSeconds(s=>s+1),1000);
    return ()=>clearInterval(timer);
  },[phase]);
  const discard=async()=>{
    if(!Pose || locked.current) return;
    locked.current=true;
    try { if(uriRef.current) await Pose.discardVideo(uriRef.current); storeUri(null); setPhase('ready'); setReady(false); setError(''); }
    catch(e){reportError(e);} finally {locked.current=false;}
  };
  const record=async()=>{
    if(!canRecord(phase,consent,ready,!!Pose) || locked.current) return;
    locked.current=true; interrupted.current=false; setError(''); setPhase('countdown');
    try {
      for(let i=3;i>0;i--) {
        if(interrupted.current || !mounted.current) return;
        setCountdown(i); await new Promise(resolve=>setTimeout(resolve,1000));
      }
      if(interrupted.current || !mounted.current) return;
      setSeconds(0); setPhase('recording');
      const clip=await camera.current?.recordAsync({maxDuration:15,maxFileSize:140_000_000});
      if(!clip?.uri) throw new Error('No recording saved. Please retry.');
      if(interrupted.current || !mounted.current) { await Pose!.discardVideo(clip.uri); return; }
      storeUri(clip.uri); setReady(false); setPhase('preview');
    } catch(e){reportError(e);}
    finally { locked.current=false; if(mounted.current && !uriRef.current) setPhase('ready'); }
  };
  const process=async()=>{
    if(!Pose || !canProcess(phase,uri,consent) || locked.current) return;
    locked.current=true; interrupted.current=false; setError(''); setProgress(0); setFrames([]); setPhase('processing');
    const source=uri!;
    try {
      const result=parseSession(await Pose.processVideo(source,view,consent));
      storeUri(null);
      const stored=parseFrames(await Pose.readFrames(result.id));
      if(mounted.current){setFrames(stored);setFrameIndex(0);}
      await refresh();
    } catch(e) { reportError(e); }
    finally {
      // A failed/cancelled attempt is not silently retained as a retry video.
      try { await Pose.discardVideo(source); storeUri(null); }
      catch(e){reportError(e);}
      locked.current=false;
      if(mounted.current){setReady(false);setPhase(uriRef.current?'preview':'ready');}
    }
  };
  const removeSession=(id:string)=>Alert.alert('Delete local session?','This permanently removes its stored landmarks from this phone.',[
    {text:'Cancel',style:'cancel'}, {text:'Delete',style:'destructive',onPress:()=>void (async()=>{await Pose!.deleteSession(id);setFrames([]);await refresh();})().catch(reportError)}
  ]);
  const active=phase==='countdown'||phase==='recording'||phase==='processing';
  const frame=frames[frameIndex];
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.kicker}>GAITSENSE · OFFLINE ANDROID PROTOTYPE</Text>
    <Text style={styles.title}>Record. Extract. Keep it local.</Text>
    <Text style={styles.text}>Engineering prototype, not a health assessment. No gait score or diagnosis is produced. Pose landmarks are estimates.</Text>
    {!Pose ? <View style={styles.notice}><Text style={styles.heading}>Native build required</Text><Text style={styles.text}>Use the GaitSense Android build with its bundled MediaPipe model. Expo Go, iOS and the public website cannot run this prototype. No simulated result will be generated.</Text></View> : <>
      <View style={styles.notice}><Text style={styles.heading}>Local-processing notice</Text><Text style={styles.text}>Only record yourself or an informed, consenting adult. Video and 33-point landmarks are processed on this phone. The temporary video is deleted after processing or discard; landmarks stay in local SQLite until you delete them. No upload or account is needed. This notice is not research-study consent.</Text>
        <Pressable accessibilityRole="checkbox" accessibilityState={{checked:consent,disabled:active||!!uri}} disabled={active||!!uri} onPress={()=>setConsent(!consent)} style={styles.choice}><Text style={styles.text}>{consent?'☑':'☐'} I understand and agree to local processing.</Text></Pressable>
      </View>
      <Text style={styles.heading}>Setup</Text><Text style={styles.text}>Use a steady phone, clear level path and even light. Keep one person's entire body visible from the side. Walk comfortably; stop if uncomfortable. Record 10–15 seconds. A three-second countdown precedes recording.</Text>
      <View style={styles.row}>{(['side_left','side_right'] as SideView[]).map(side=><Action key={side} label={view===side?`✓ ${side}`:side} disabled={active||!!uri} onPress={()=>setView(side)}/>)}</View>
      {!permission?.granted ? <Action label="Allow camera (no microphone)" onPress={()=>void requestPermission().catch(reportError)}/> : <>
        {uri && phase==='preview' ? <Preview uri={uri}/> : phase!=='processing' && <CameraView key="camera" ref={camera} style={styles.camera} facing="back" mode="video" mute videoQuality="720p" onCameraReady={()=>setReady(true)} onMountError={e=>{setReady(false);setError(e.message);}}/>}
        {phase==='ready' && <Action label="Record 15-second video" disabled={!canRecord(phase,consent,ready,!!Pose)} onPress={()=>void record()}/>}
        {phase==='countdown' && <><Text accessibilityLiveRegion="polite" style={styles.heading}>Starting in {countdown}…</Text><Action label="Cancel countdown" onPress={()=>{interrupted.current=true;}}/></>}
        {phase==='recording' && <><Text style={styles.heading}>Recording {seconds}s / 15s</Text><Action label="Stop recording" onPress={()=>camera.current?.stopRecording()}/></>}
        {phase==='preview' && <><Action label="Extract landmarks on this phone" disabled={!consent} onPress={()=>void process()}/><Action label="Discard video / retake" onPress={()=>void discard()}/></>}
      </>}
      {phase==='processing' && <View style={styles.notice}><Text accessibilityLiveRegion="polite" style={styles.heading}>Extracting landmarks… {progress}%</Text><Text style={styles.text}>Keep the app open. This uses the bundled model, not a server.</Text><Action label="Cancel processing" onPress={()=>Pose?.cancel()}/></View>}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {!!frames.length && <View style={styles.notice}><Text style={styles.heading}>Saved landmark inspection</Text><Text style={styles.text}>{frames.length} pose frames · frame {frameIndex+1} · {frame?.timestampMs} ms</Text><View style={styles.plot}>{frame?.landmarks.filter(p=>p.visibility>=.6&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1).map(p=><View key={p.index} style={[styles.dot,{left:`${p.x*100}%`,top:`${p.y*100}%`}]}/>)}</View><View style={styles.row}><Action label="Previous frame" disabled={frameIndex===0} onPress={()=>setFrameIndex(i=>i-1)}/><Action label="Next frame" disabled={frameIndex===frames.length-1} onPress={()=>setFrameIndex(i=>i+1)}/></View><Text style={styles.text}>Normalized landmark preview only. Not a calibrated skeleton or gait measurement.</Text></View>}
      <Text style={styles.heading}>On-device history ({sessions.length}, latest 100)</Text>
      <Text style={styles.text}>If the app was force-closed during recording, a temporary camera video may remain. Clear leftovers below before lending or sharing this phone.</Text>
      <Action label="Clear leftover temporary camera videos" disabled={active||!!uri} onPress={()=>Alert.alert('Clear temporary recordings?','Deletes camera-cache videos from this app only, including interrupted recordings. Saved landmarks are kept.',[{text:'Cancel',style:'cancel'},{text:'Clear',style:'destructive',onPress:()=>void Pose!.clearTemporaryVideos().then(()=>setError('Temporary camera videos cleared.')).catch(reportError)}])}/>
      {sessions.length===0 && <Text style={styles.text}>No saved landmark sessions yet.</Text>}
      {sessions.map(s=><View key={s.id} style={styles.notice}><Text style={styles.heading}>{new Date(s.createdAt).toLocaleString()}</Text><Text style={styles.text}>{s.poseFrames} frames · {(s.usableFrameRatio*100).toFixed(0)}% usable · {s.view} · raw video deleted</Text><Action label="Read saved landmarks" disabled={active} onPress={()=>void Pose!.readFrames(s.id).then(raw=>{setFrames(parseFrames(raw));setFrameIndex(0);}).catch(reportError)}/><Action label="Delete this session" disabled={active} onPress={()=>removeSession(s.id)}/></View>)}
      {!!sessions.length && <Action label="Delete all local landmark history" disabled={active} onPress={()=>Alert.alert('Delete all local history?','This cannot be undone.',[{text:'Cancel',style:'cancel'},{text:'Delete all',style:'destructive',onPress:()=>void Pose!.deleteAll().then(()=>{setFrames([]);return refresh();}).catch(reportError)}])}/>}
    </>}
  </ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:'#f4f8f6'},content:{padding:20,gap:16,paddingBottom:50},
  kicker:{fontSize:12,color:'#126b57',fontWeight:'700'},title:{fontSize:28,fontWeight:'800',color:'#16352e'},
  heading:{fontSize:18,fontWeight:'700',color:'#16352e'},text:{fontSize:16,lineHeight:24,color:'#344b45'},
  notice:{backgroundColor:'white',padding:16,borderRadius:14,gap:12},choice:{paddingVertical:12},
  camera:{width:'100%',height:320,backgroundColor:'#142b34',borderRadius:14},
  button:{backgroundColor:'#126b57',padding:15,borderRadius:10,alignItems:'center'},
  buttonText:{color:'white',fontSize:16,fontWeight:'600'},disabled:{opacity:.4},row:{flexDirection:'row',flexWrap:'wrap',gap:10},
  error:{color:'#a02020',fontSize:16,lineHeight:24},plot:{height:300,backgroundColor:'#102d27',overflow:'hidden',borderRadius:10},
  dot:{position:'absolute',width:6,height:6,borderRadius:3,backgroundColor:'#8cffc6',marginLeft:-3,marginTop:-3},
});
