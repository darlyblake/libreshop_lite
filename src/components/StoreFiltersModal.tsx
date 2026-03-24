import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Switch, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';
import { countryService } from '../lib/countryService';
import { cityService } from '../lib/cityService';

type Props = {
  visible: boolean;
  onClose: () => void;
  categories: string[];
  initial?: { category?: string; deliveryOnly?: boolean; minRating?: number; countryId?: string; cityId?: string };
  onApply: (filters: { category?: string; deliveryOnly?: boolean; minRating?: number; countryId?: string; cityId?: string }) => void;
};

export const StoreFiltersModal: React.FC<Props> = ({ visible, onClose, categories, initial, onApply }) => {
  const [category, setCategory] = useState<string | undefined>(initial?.category || 'Toutes');
  const [deliveryOnly, setDeliveryOnly] = useState<boolean>(initial?.deliveryOnly || false);
  const [minRating, setMinRating] = useState<number>(initial?.minRating || 0);
  const [countries, setCountries] = useState<{ id: string; name: string }[]>([]);
  const [countryId, setCountryId] = useState<string | undefined>(initial?.countryId);
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [cityId, setCityId] = useState<string | undefined>(initial?.cityId);
  const [cityQuery, setCityQuery] = useState('');

  useEffect(() => {
    if (visible) {
      setCategory(initial?.category || 'Toutes');
      setDeliveryOnly(initial?.deliveryOnly || false);
      setMinRating(initial?.minRating || 0);
      setCountryId(initial?.countryId);
      setCityId(initial?.cityId);
      setCityQuery('');
      // load countries
      (async () => {
        try {
          const cts = await countryService.getAll();
          setCountries(cts);
          if (initial?.countryId) {
            const cs = await cityService.searchByCountry(initial.countryId, '', 50);
            setCities(cs);
          } else {
            setCities([]);
          }
        } catch (e) {
          // ignore errors for now
        }
      })();
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Filtres</Text>
            <TouchableOpacity onPress={onClose} style={styles.close}> 
              <Ionicons name="close" size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Catégorie</Text>
            <View style={styles.categoriesRow}>
              {categories.slice(0, 8).map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.catChip, c === category && styles.catChipActive]}
                  onPress={() => setCategory(c)}
                >
                  <Text style={[styles.catText, c === category && styles.catTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.rowSpace}>
            <Text style={styles.label}>Livraison uniquement</Text>
            <Switch value={deliveryOnly} onValueChange={setDeliveryOnly} />
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Pays</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: SPACING.sm }}>
              {countries.slice(0, 12).map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.catChip, c.id === countryId && styles.catChipActive]}
                  onPress={async () => {
                    setCountryId(c.id);
                    setCityId(undefined);
                    try {
                      const cs = await cityService.searchByCountry(c.id, '', 50);
                      setCities(cs);
                    } catch (e) {
                      setCities([]);
                    }
                  }}
                >
                  <Text style={[styles.catText, c.id === countryId && styles.catTextActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Ville</Text>
            <TextInput
              placeholder="Rechercher une ville..."
              value={cityQuery}
              onChangeText={async (t) => {
                setCityQuery(t);
                if (countryId) {
                  try {
                    const cs = await cityService.searchByCountry(countryId, t, 20);
                    setCities(cs);
                  } catch (e) {
                    setCities([]);
                  }
                }
              }}
              style={{ backgroundColor: COLORS.card, padding: SPACING.sm, borderRadius: RADIUS.md, marginTop: SPACING.sm }}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: SPACING.sm, marginTop: SPACING.sm }}>
              {cities.map((ct) => (
                <TouchableOpacity
                  key={ct.id}
                  style={[styles.catChip, ct.id === cityId && styles.catChipActive]}
                  onPress={() => setCityId(ct.id)}
                >
                  <Text style={[styles.catText, ct.id === cityId && styles.catTextActive]}>{ct.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.rowSpace}>
            <Text style={styles.label}>Note minimale</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[0,1,2,3,4,5].map((n) => (
                <TouchableOpacity key={n} onPress={() => setMinRating(n)} style={[styles.ratingBtn, minRating===n && styles.ratingBtnActive]}>
                  <Text style={minRating===n ? styles.ratingTextActive : styles.ratingText}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={() => {
                setCategory('Toutes');
                setDeliveryOnly(false);
                setMinRating(0);
                setCountryId(undefined);
                setCityId(undefined);
                setCityQuery('');
              }}
            >
              <Text style={styles.resetText}>Réinitialiser</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyBtn}
              onPress={() => {
                onApply({ category, deliveryOnly, minRating, countryId, cityId });
                onClose();
              }}
            >
              <Text style={styles.applyText}>Appliquer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.bg, padding: SPACING.lg, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  title: { fontSize: FONT_SIZE.lg, fontWeight: '700', color: COLORS.text },
  close: { padding: SPACING.sm },
  row: { marginBottom: SPACING.md },
  rowSpace: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  label: { fontSize: FONT_SIZE.md, color: COLORS.text, fontWeight: '600' },
  categoriesRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm, flexWrap: 'wrap' },
  catChip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, marginRight: SPACING.sm, marginBottom: SPACING.sm },
  catChipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  catText: { color: COLORS.textMuted },
  catTextActive: { color: COLORS.text },
  ratingBtn: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, backgroundColor: COLORS.card, borderRadius: RADIUS.md },
  ratingBtnActive: { backgroundColor: COLORS.accent },
  ratingText: { color: COLORS.textMuted },
  ratingTextActive: { color: COLORS.text },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.md },
  resetBtn: { padding: SPACING.md },
  resetText: { color: COLORS.textMuted },
  applyBtn: { backgroundColor: COLORS.accent, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.md },
  applyText: { color: COLORS.text, fontWeight: '700' },
});

export default StoreFiltersModal;
