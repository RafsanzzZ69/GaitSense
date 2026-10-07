import {Pressable,Text,View,StyleSheet} from 'react-native';

export function RecordingAnalysisSetupControls({direction,upright,disabled,onDirection,onUpright}: {
  direction:1|-1|null; upright:boolean; disabled:boolean;
  onDirection:(value:1|-1|null)=>void; onUpright:(value:boolean)=>void;
}) {
  return <View style={styles.group}>
    <Text accessibilityRole="header" style={styles.heading}>Recording analysis setup</Text>
    <Text style={styles.text}>Visible anatomical side and image travel direction are separate. Choose one straight travel direction in the image for this recording; keep the camera steady and avoid turns.</Text>
    {([[null,'Travel direction not specified'],[1,'Moves toward image right'],[-1,'Moves toward image left']] as const).map(([value,label])=>
      <Pressable key={label} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{checked:direction===value,disabled}}
        disabled={disabled} onPress={()=>onDirection(value)} style={styles.choice}><Text style={styles.text}>{direction===value?'◉':'○'} {label}</Text></Pressable>)}
    <Pressable accessibilityRole="checkbox" accessibilityLabel="Confirm upright image orientation for this recording"
      accessibilityState={{checked:upright,disabled}} disabled={disabled} onPress={()=>onUpright(!upright)} style={styles.choice}>
      <Text style={styles.text}>{upright?'☑':'☐'} I confirm the image orientation is upright for this recording.</Text>
    </Pressable>
    <Text style={styles.text}>Confirm the person appears upright in the image, not sideways or upside down. Holding the phone upright alone does not establish this. These are operator assertions, not scientific validation. Unspecified setup is allowed, but limits saved analysis. Setup is locked at countdown and resets after each attempt.</Text>
  </View>;
}
const styles=StyleSheet.create({group:{gap:8},heading:{fontSize:18,fontWeight:'700',color:'#16352e'},
  text:{fontSize:16,lineHeight:24,color:'#344b45'},choice:{minHeight:48,paddingVertical:12}});
