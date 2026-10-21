import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import type { CustomerBookingRecord } from '../lib/api/types';
import { appointmentDayLabel } from '../lib/appointment-feed';
import { tokens as t } from '../theme/tokens';

export function UpcomingAppointmentCard({booking,count,onDetails,onViewAll}:{booking:CustomerBookingRecord;count:number;onDetails:()=>void;onViewAll:()=>void}) {
 const date=new Date(booking.startsAt), all=count===1?'All bookings':`View all ${count}`;
 return <View style={s.card}>
  <View style={s.header}><Text style={s.eyebrow}>Next appointment</Text><Text style={s.count} accessibilityLabel={`${count} upcoming appointment${count===1?'':'s'}`}>{count} upcoming</Text></View>
  <Pressable style={s.row} accessibilityRole="button" accessibilityLabel={`View ${booking.service.name} appointment details`} onPress={onDetails}>
   <View style={s.date}><Text style={s.weekday}>{date.toLocaleDateString(undefined,{weekday:'short'})}</Text><Text style={s.day}>{date.getDate()}</Text></View>
   <View style={s.body}><Text style={s.title} numberOfLines={2}>{booking.service.name}</Text><Text style={s.meta} numberOfLines={1}>{booking.provider.displayName}</Text><Text style={s.meta}>{appointmentDayLabel(booking.startsAt).split(' · ')[0]} · {date.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit',timeZoneName:'short'})}</Text></View>
   <FontAwesome6 name="chevron-right" size={14} color="#ffffff"/>
  </Pressable>
  <View style={s.actions}><Pressable onPress={onDetails} style={s.primary} accessibilityRole="button"><Text style={s.primaryText}>View details</Text></Pressable><Pressable onPress={onViewAll} style={s.secondary} accessibilityRole="button" accessibilityLabel={count===1?'View all bookings':`View all ${count} upcoming appointments`}><Text style={s.secondaryText}>{all}</Text></Pressable></View>
 </View>;
}
const s=StyleSheet.create({
 card:{borderRadius:t.radius.lg,backgroundColor:t.colors.inkDeep,padding:18,gap:14},
 header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'},
 eyebrow:{color:t.colors.brand,fontSize:11,fontFamily:t.font.bold,letterSpacing:1,textTransform:'uppercase'},
 count:{color:'#fff',fontFamily:t.font.semibold,fontSize:11,backgroundColor:'rgba(255,255,255,0.1)',paddingHorizontal:9,paddingVertical:5,borderRadius:20},
 row:{flexDirection:'row',alignItems:'center',gap:12},date:{width:48,height:54,borderRadius:12,backgroundColor:t.colors.navySoft,alignItems:'center',justifyContent:'center'},
 weekday:{color:t.colors.onNavyMuted,fontSize:10,fontFamily:t.font.bold,textTransform:'uppercase'},day:{color:'#fff',fontSize:21,fontFamily:t.font.display},body:{flex:1,minWidth:0,gap:3},
 title:{color:'#fff',fontSize:16,fontFamily:t.font.bold},meta:{color:t.colors.onNavyMuted,fontSize:12,fontFamily:t.font.regular},
 actions:{flexDirection:'row',gap:8,flexWrap:'wrap'},primary:{flexGrow:1,flexBasis:110,minHeight:44,padding:10,borderRadius:t.radius.sm,backgroundColor:t.colors.brand,alignItems:'center',justifyContent:'center'},primaryText:{color:t.colors.inkDeep,fontFamily:t.font.bold,fontSize:13},
 secondary:{flexGrow:1,flexBasis:110,minHeight:44,padding:10,borderRadius:t.radius.sm,borderWidth:1,borderColor:'rgba(255,255,255,0.2)',alignItems:'center',justifyContent:'center'},secondaryText:{color:'#fff',fontFamily:t.font.semibold,fontSize:13},
});
