import React from 'react';
import { TripStop } from '../types';
import { 
  Footprints, Car, Train, Navigation, 
  Utensils, Coffee, ShoppingBag, Mountain, Landmark, Camera, Ticket, MapPin, Bed, Flag
} from 'lucide-react';

// Helper icon for transport
export const TransportIcon = ({ text }: { text: string }) => {
  const lower = text.toLowerCase();
  if (lower.includes('walk') || lower.includes('foot') || lower.includes('步行') || lower.includes('走')) return <Footprints className="w-3 h-3" />;
  if (lower.includes('car') || lower.includes('drive') || lower.includes('taxi') || lower.includes('uber') || lower.includes('車') || lower.includes('計程車')) return <Car className="w-3 h-3" />;
  if (lower.includes('train') || lower.includes('subway') || lower.includes('rail') || lower.includes('shinkansen') || lower.includes('鐵') || lower.includes('新幹線') || lower.includes('捷運')) return <Train className="w-3 h-3" />;
  return <Navigation className="w-3 h-3" />;
};

// Helper to deduce icon from stop details
export const getStopIcon = (stop: TripStop) => {
  // 1. Precise Type Matching (New Logic)
  if (stop.type) {
    switch (stop.type) {
      case 'dining': return Utensils;
      case 'cafe': return Coffee;
      case 'nature': return Mountain;
      case 'attraction': return MapPin; // Generic attraction
      case 'landmark': return Landmark;
      case 'history': return Landmark; // Temples, Museums
      case 'shopping': return ShoppingBag;
      case 'transport': return Train;
      case 'activity': return Ticket; // Theme parks, experiences
      case 'accommodation': return Bed;
      case 'other': return Flag;
      default:
        // Fall through to text matching if type is unknown
        break;
    }
  }

  // 2. Heuristic Matching (Fallback for old data or missing type)
  const text = (stop.name + ' ' + (stop.notes || '')).toLowerCase();
  
  // Dining
  if (
    text.includes('lunch') || text.includes('dinner') || text.includes('breakfast') || 
    text.includes('eat') || text.includes('restaurant') || text.includes('food') || 
    text.includes('izakaya') || text.includes('ramen') || text.includes('sushi') ||
    text.includes('午餐') || text.includes('晚餐') || text.includes('早餐') || 
    text.includes('餐廳') || text.includes('美食') || text.includes('料理') || 
    text.includes('燒肉') || text.includes('居酒屋') || text.includes('食') ||
    text.includes('食堂') || text.includes('懷石') || text.includes('小吃')
  ) return Utensils;

  // Coffee/Dessert
  if (
    text.includes('coffee') || text.includes('cafe') || text.includes('tea') || text.includes('dessert') ||
    text.includes('咖啡') || text.includes('甜點') || text.includes('下午茶') || text.includes('喫茶') ||
    text.includes('蛋糕') || text.includes('冰淇淋') || text.includes('茶屋')
  ) return Coffee;

  // Shopping
  if (
    text.includes('shop') || text.includes('mall') || text.includes('store') || text.includes('market') || 
    text.includes('buy') || text.includes('souvenir') ||
    text.includes('購物') || text.includes('商場') || text.includes('百貨') || text.includes('商店') || 
    text.includes('市集') || text.includes('伴手禮') || text.includes('藥妝') || text.includes('outlet') ||
    text.includes('唐吉訶德') || text.includes('don quijote') || text.includes('超市')
  ) return ShoppingBag;

  // Nature (Mountain)
  if (
    text.includes('park') || text.includes('garden') || text.includes('nature') || text.includes('mountain') || 
    text.includes('hike') || text.includes('beach') ||
    text.includes('公園') || text.includes('花園') || text.includes('御苑') || text.includes('山') || 
    text.includes('川') || text.includes('湖') || text.includes('海') || text.includes('散步')
  ) return Mountain;

  // Landmark/Culture
  if (
    text.includes('museum') || text.includes('gallery') || text.includes('temple') || text.includes('shrine') || 
    text.includes('church') || text.includes('castle') || text.includes('palace') || text.includes('tower') ||
    text.includes('寺') || text.includes('神社') || text.includes('宮') || text.includes('城') || 
    text.includes('塔') || text.includes('博物館') || text.includes('美術館') || text.includes('紀念') ||
    text.includes('大佛')
  ) return Landmark;

  // Sightseeing/Photo
  if (
    text.includes('photo') || text.includes('view') || text.includes('observation') || text.includes('sight') ||
    text.includes('展望') || text.includes('夜景') || text.includes('景色') || text.includes('拍照') ||
    text.includes('打卡') || text.includes('巡禮')
  ) return Camera;

  // Tickets/Amusement
  if (
    text.includes('ticket') || text.includes('entrance') || text.includes('disney') || text.includes('universal') ||
    text.includes('門票') || text.includes('入場') || text.includes('樂園') || text.includes('影城') || 
    text.includes('迪士尼') || text.includes('動物園') || text.includes('水族館') || text.includes('遊樂園')
  ) return Ticket;
  
  // Transport Hubs
  if (
      text.includes('station') || text.includes('airport') || text.includes('terminal') ||
      text.includes('車站') || text.includes('駅') || text.includes('機場') || text.includes('空港') || text.includes('航廈') ||
      text.includes('轉運站') || text.includes('バスタ')
  ) return Train;

  // Hotel/Accommodation
  if (
      text.includes('hotel') || text.includes('hostel') || text.includes('inn') ||
      text.includes('飯店') || text.includes('酒店') || text.includes('旅館') || text.includes('住宿')
  ) return Bed;

  return MapPin;
};
