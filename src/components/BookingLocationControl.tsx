import {Pressable,StyleSheet,Text,View} from 'react-native';
import {FontAwesome6} from '@expo/vector-icons';
import {useRouter} from 'expo-router';
import {tokens as t} from '../theme/tokens';

export function BookingLocationControl({label,detecting=false}:{label:string;detecting?:boolean}){
 const router=useRouter();
 return <Pressable accessibilityRole="button" accessibilityLabel={`Change booking location: ${label}`} accessibilityHint="Choose a city or country, or use your current location" onPress={()=>router.push('/choose-city' as never)} style={({pressed})=>[s.root,pressed&&s.pressed]}>
  <View style={s.icon}><FontAwesome6 name="location-dot" size={18} color={t.colors.ink}/></View>
  <View style={s.body}><Text style={s.caption}>BOOKING LOCATION</Text><Text style={s.location} numberOfLines={2}>{detecting?'Finding your location…':label}</Text></View>
  <View style={s.action}><Text style={s.change}>Change</Text><FontAwesome6 name="chevron-down" size={12} color={t.colors.ink}/></View>
 </Pressable>;
}
const s=StyleSheet.create({root:{minHeight:68,padding:14,borderRadius:18,borderWidth:1,borderColor:'#dce8ce',backgroundColor:'#f3f8ed',flexDirection:'row',alignItems:'center',gap:12},pressed:{backgroundColor:'#e8f1dd'},icon:{width:38,height:38,borderRadius:13,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},body:{flex:1,minWidth:0,gap:4},caption:{fontSize:10,letterSpacing:1,fontFamily:t.font.semibold,color:t.colors.muted},location:{fontSize:14,lineHeight:20,fontFamily:t.font.semibold,color:t.colors.ink},action:{flexDirection:'row',alignItems:'center',gap:8,minHeight:44},change:{fontSize:13,fontFamily:t.font.semibold,color:t.colors.ink}});
