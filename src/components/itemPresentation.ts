import type { EquipmentSlotId, ItemCategory } from '../data'
import { abiAssetById } from '../data/abi-assets.generated'
import type { InventoryItemRecord } from './grids/types'

const CATEGORY_SHORT_LABELS: Record<ItemCategory, string> = {
  helmet: 'HEAD',
  face_shield: 'SHIELD',
  mask: 'MASK',
  headset: 'COMMS',
  weapon_primary: 'PRIMARY',
  weapon_secondary: 'SECOND',
  weapon_pistol: 'SIDEARM',
  vest_tactical: 'RIG',
  vest_ballistic: 'ARMOR',
  backpack: 'PACK',
  ammo: 'AMMO',
  ammo_box: 'BOX',
  medkit: 'MED',
  consumable: 'UTIL',
  container_misc: 'KIT',
}

const CATEGORY_GLYPHS: Record<ItemCategory, string> = {
  helmet: '◖',
  face_shield: '▣',
  mask: '◌',
  headset: '◉',
  weapon_primary: '⌁',
  weapon_secondary: '≣',
  weapon_pistol: '⊣',
  vest_tactical: '▥',
  vest_ballistic: '▦',
  backpack: '▤',
  ammo: '•',
  ammo_box: '⋰',
  medkit: '+',
  consumable: '◍',
  container_misc: '⌂',
}

const CATEGORY_TINTS: Record<ItemCategory, string> = {
  helmet: '#3d434d',
  face_shield: '#434951',
  mask: '#4b443a',
  headset: '#384146',
  weapon_primary: '#69292a',
  weapon_secondary: '#7a3527',
  weapon_pistol: '#643036',
  vest_tactical: '#314432',
  vest_ballistic: '#474031',
  backpack: '#374b35',
  ammo: '#5b3432',
  ammo_box: '#51413a',
  medkit: '#6f5822',
  consumable: '#645124',
  container_misc: '#5a4a22',
}

const WEAPON_SLOT_BADGES: Partial<Record<EquipmentSlotId, string>> = {
  primaryWeapon: '1',
  secondaryWeapon: '2',
  pistol: '3',
}

export const getItemTint = (item: InventoryItemRecord): string => {
  if (item.tags.includes('weapon') || item.tags.includes('ammo')) {
    return '#6d2a2b'
  }

  if (item.tags.includes('medical') || item.category === 'medkit' || item.category === 'consumable') {
    return '#715924'
  }

  if (item.tags.includes('holder-shell') || item.category === 'backpack') {
    return '#344734'
  }

  if (item.tags.includes('misc')) {
    return '#675623'
  }

  return CATEGORY_TINTS[item.category] ?? '#3f4248'
}

export const getItemGlyph = (item: InventoryItemRecord): string =>
  CATEGORY_GLYPHS[item.category] ?? item.name.slice(0, 1)

export const getItemImageSrc = (item: InventoryItemRecord): string | null => {
  const assetId = item.itemDefinitionId.startsWith('abi-') ? item.itemDefinitionId.slice(4) : item.itemDefinitionId
  return abiAssetById[assetId]?.assetPath ?? null
}

export const getItemDescriptor = (item: InventoryItemRecord): string =>
  item.uiStateLabel?.toUpperCase() ?? CATEGORY_SHORT_LABELS[item.category]

export const getItemStatusChip = (item: InventoryItemRecord): string | null =>
  item.currentDurability !== undefined ? `♥${item.currentDurability}` : item.uiStateLabel?.toUpperCase() ?? null

export const getItemCounterLabel = (item: InventoryItemRecord): string =>
  item.currentDurability !== undefined ? `${item.currentDurability}` : `${item.boundingWidth}×${item.boundingHeight}`

export const getWeaponSlotBadge = (slotId: EquipmentSlotId): string | null => WEAPON_SLOT_BADGES[slotId] ?? null
