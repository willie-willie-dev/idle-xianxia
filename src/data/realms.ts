import type { RealmConfig, Realm } from '../types';

export const REALM_ORDER: Realm[] = [
  '炼气', '筑基', '金丹', '元婴', '化神', '合体', '大乘', '渡劫', '仙人',
];

export const REALMS: Record<Realm, RealmConfig> = {
  '炼气': { realm: '炼气', levelReq: 1, multiplier: 1.0, materials: [] },
  '筑基': { realm: '筑基', levelReq: 10, multiplier: 1.5, materials: [{ name: '筑基丹', count: 1 }] },
  '金丹': { realm: '金丹', levelReq: 25, multiplier: 2.5, materials: [{ name: '金丹碎片', count: 3 }] },
  '元婴': { realm: '元婴', levelReq: 45, multiplier: 4.0, materials: [{ name: '元婴果', count: 2 }] },
  '化神': { realm: '化神', levelReq: 70, multiplier: 6.5, materials: [{ name: '化神莲', count: 1 }] },
  '合体': { realm: '合体', levelReq: 100, multiplier: 10.0, materials: [{ name: '合体石', count: 3 }] },
  '大乘': { realm: '大乘', levelReq: 135, multiplier: 16.0, materials: [{ name: '大乘灵液', count: 2 }] },
  '渡劫': { realm: '渡劫', levelReq: 175, multiplier: 25.0, materials: [{ name: '渡劫丹', count: 1 }] },
  '仙人': { realm: '仙人', levelReq: 220, multiplier: 40.0, materials: [{ name: '仙缘石', count: 5 }] },
};
