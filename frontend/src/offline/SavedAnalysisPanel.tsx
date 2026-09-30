import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useState} from 'react';
import type {SavedAnalysisPresentation} from './analysis-presentation';
import {savedAnalysisPanel} from './saved-analysis-binding';

function ResultGroup({group}: {group:ReturnType<typeof savedAnalysisPanel>['groups'][number]}) {
  const [expanded,setExpanded]=useState(false);
  const collapsible=group.expandable && group.lines.length>1;
  return <View style={styles.group}>
    <Text style={styles.title}>{group.title}</Text>
    {(collapsible&&!expanded?group.lines.slice(0,1):group.lines).map((line,index)=><Text key={index} selectable style={styles.text}>{line}</Text>)}
    {collapsible && <Pressable accessibilityRole="button" accessibilityState={{expanded}} onPress={()=>setExpanded(!expanded)}>
      <Text style={styles.text}>{expanded?'Hide':'Show'} observations and exclusions</Text>
    </Pressable>}
  </View>;
}

export function SavedAnalysisPanel({presentation,onClear}: {presentation:SavedAnalysisPresentation;onClear:()=>void}) {
  const panel=savedAnalysisPanel(presentation);
  return <View style={styles.panel}>
    <Text accessibilityLiveRegion="polite" style={styles.title}>{panel.title}</Text>
    <Text selectable style={styles.text}>Selected session: {panel.sessionId ?? 'None'}</Text>
    {panel.lines.map((line,index)=><Text key={index} selectable style={styles.text}>{line}</Text>)}
    {panel.groups.map(group=><ResultGroup key={`${presentation.selection.generation}:${group.title}`} group={group}/>)}
    <Pressable accessibilityRole="button" onPress={onClear} style={styles.button}><Text style={styles.buttonText}>Close saved analysis</Text></Pressable>
  </View>;
}
const styles=StyleSheet.create({panel:{backgroundColor:'white',padding:16,borderRadius:14,gap:12},
 group:{gap:6},title:{fontSize:18,fontWeight:'700',color:'#16352e'},text:{fontSize:16,lineHeight:24,color:'#344b45'},
 button:{backgroundColor:'#126b57',padding:15,borderRadius:10},buttonText:{color:'white',textAlign:'center',fontWeight:'600'}});
