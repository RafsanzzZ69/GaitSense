import React from 'react';
import * as theme from '../../src/constants/theme.ts';
import { measurementPage } from '../../src/measurement/measurement-page.ts';
import { load } from './auth-controller-harness.mjs';

// Production layout presentation with deterministic React hooks/navigation seams.
// This does not simulate native mounting or substitute for device acceptance.
export function flow(access, { pathname = '/measurement/setup', boundary = { canStart: () => true } } = {}) {
  const states=[], refs=[], effects=[], nodes=[], navigations=[], alerts=[], dispatches=[];
  let cursor=0, refCursor=0, effectCursor=0, back, prevent;
  const router=Object.fromEntries(['replace','dismissTo'].map(name=>[name,href=>{navigations.push([name,href]);if(name==='replace') pathname=href;}]));
  const equal=(a,b)=>a&&b&&a.length===b.length&&a.every((value,i)=>value===b[i]);
  const hooks={...React,useCallback:fn=>fn,
    useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];},
    useRef(initial){const i=refCursor++;return refs[i]??={current:initial};},
    useEffect(fn,deps){const i=effectCursor++, previous=effects[i];if(!previous||!equal(previous.deps,deps))effects[i]={fn,deps,pending:true,cleanup:previous?.cleanup};},
  };
  const native={StyleSheet:{create:value=>value},Alert:{alert:(...args)=>alerts.push(args)},BackHandler:{addEventListener(_,fn){back=fn;return {remove(){if(back===fn)back=undefined;}};}}};
  for(const name of ['ActivityIndicator','Pressable','ScrollView','Text','View'])native[name]=name;
  const Flow=load('src/measurement/MeasurementFlow.tsx',{
    react:hooks,'react-native':native,'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},'@/constants/theme':theme,
    'expo-router':{Slot:()=>null,useRouter:()=>router,useNavigation:()=>({dispatch:action=>dispatches.push(action)}),usePathname:()=>pathname,useFocusEffect:fn=>hooks.useEffect(fn,[fn])},
    'expo-router/react-navigation':{usePreventRemove:(_,fn)=>{prevent=fn;}},
    '@/navigation/NavigationSettlement':{useNavigationSettlement:()=>boundary},'./measurement-page':{measurementPage},
    './MeasurementResults':{MeasurementResults:()=>React.createElement('ResultsFromSavedLoader')},
  }).MeasurementFlow;
  function expand(node){if(Array.isArray(node)){node.forEach(expand);return;}if(!React.isValidElement(node)){if(typeof node==='string'||typeof node==='number')nodes.push(node);return;}
    if(typeof node.type==='function'){expand(node.type(node.props));return;}nodes.push(node);expand(node.props.children);}
  function render(){cursor=refCursor=effectCursor=0;nodes.length=0;expand(Flow({access}));for(const effect of effects)if(effect.pending){effect.cleanup?.();effect.cleanup=effect.fn();effect.pending=false;}}
  render();
  return {access,nodes,navigations,alerts,dispatches,render,button:label=>nodes.find(n=>n.type==='Pressable'&&n.props.accessibilityLabel===label)?.props,
    text:()=>nodes.filter(n=>typeof n==='string'||typeof n==='number').join(' '),
    back:()=>back?.(),remove:action=>prevent({data:{action}}),deepLink:href=>{pathname=href;render();},
    has:type=>nodes.some(n=>n.type===type),unmount:()=>effects.forEach(effect=>effect.cleanup?.())};
}
export function access(overrides={}) {
  return {phase:'ready',consent:false,ready:false,nativeAvailable:true,view:'side_left',direction:null,upright:false,
    uri:null,countdown:3,seconds:0,error:'',completed:null,selectedSession:null,analysis:null,canLeave:()=>true,canContinue:()=>false,
    prepareCamera(){},canRecord:false,record(){},process(){},discard(){},cancelCountdown(){},stop(){},
    ...Object.fromEntries(['setup','camera','preview','history','technical','processing'].map(name=>[name,React.createElement(name==='camera'?'ExistingCamera':name==='technical'?'RawDiagnostics':`Existing${name}`)])),...overrides};
}
