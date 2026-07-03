const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/screens/ClientSearchScreen.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add sidebar state
code = code.replace(
  /const \[selectedCategory, setSelectedCategory\] = useState<string \| null>\(null\);/,
  `const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeSidebarSubcategory, setActiveSidebarSubcategory] = useState<string | null>(null);`
);

// 2. Add sidebar renderer
const sidebarRenderer = `
  const handleToggleSidebarCategory = useCallback((categoryId: string, categoryName: string) => {
    if (selectedCategory === categoryName) {
      // Toggle off
      setSelectedCategory(null);
      setActiveSidebarSubcategory(null);
      setSearchQuery('');
      debouncedSearch(''); // Or some function to reset to all products
    } else {
      setSelectedCategory(categoryName);
      setActiveSidebarSubcategory(null);
      setSearchQuery('');
      searchByCategory(categoryName);
    }
  }, [selectedCategory, searchByCategory, debouncedSearch]);

  const handleSidebarSubcategoryPress = useCallback((subcategoryId: string, subcategoryName: string, parentCategoryName: string) => {
    setActiveSidebarSubcategory(subcategoryId);
    setSelectedCategory(parentCategoryName);
    setSearchQuery('');
    // For now, subcategory search might just be text search on subcategory name or category search.
    // If you have getByCategory, you might need to filter by subcategory.
    // We'll use debouncedSearch with the subcategory name to find it in the products.
    debouncedSearch(subcategoryName);
  }, [debouncedSearch]);

  const renderSidebar = () => {
    if (Platform.OS !== 'web' && width <= 768) return null; // On native mobile, we can hide sidebar or make it a drawer

    return (
      <View style={styles.sidebar}>
        <View style={styles.sidebarHeader}>
          <Text style={styles.sidebarLogo}>
            Libre<Text style={styles.sidebarLogoAccent}>Shop</Text>
          </Text>
        </View>
        <Text style={styles.sidebarTitle}>📂 Catégories</Text>
        <ScrollView style={styles.sidebarScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.categoryList}>
            {popularCategories.map(cat => {
              const isActive = selectedCategory === cat.name;
              return (
                <View key={cat.id}>
                  <TouchableOpacity
                    style={[styles.sidebarCategoryItem, isActive && styles.sidebarCategoryItemActive]}
                    onPress={() => handleToggleSidebarCategory(cat.id, cat.name)}
                  >
                    <View style={[styles.sidebarCategoryIcon, isActive && styles.sidebarCategoryIconActive]}>
                      <Ionicons name={cat.icon as any} size={18} color={isActive ? 'white' : palette.text} />
                    </View>
                    <Text style={[styles.sidebarCategoryName, isActive && styles.sidebarCategoryNameActive]}>{cat.name}</Text>
                  </TouchableOpacity>
                  
                  {isActive && cat.subcategories && cat.subcategories.length > 0 && (
                    <Animated.View entering={FadeInDown.duration(200)} style={styles.sidebarSubcategoryContainer}>
                      {cat.subcategories.map(sub => {
                        const isSubActive = activeSidebarSubcategory === sub.id;
                        return (
                          <TouchableOpacity
                            key={sub.id}
                            style={[styles.sidebarSubcategoryItem, isSubActive && styles.sidebarSubcategoryItemActive]}
                            onPress={() => handleSidebarSubcategoryPress(sub.id, sub.name, cat.name)}
                          >
                            <Text style={[styles.sidebarSubcategoryName, isSubActive && styles.sidebarSubcategoryNameActive]}>
                              {sub.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </Animated.View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  };
`;

code = code.replace(/const renderProductItem = useCallback\(/, sidebarRenderer + '\n  const renderProductItem = useCallback(');

// 3. Update main render layout
const newRender = `
  const isWebLarge = Platform.OS === 'web' && width > 768;

  return (
    <View style={styles.flexContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={[styles.appContainer, isWebLarge && { flexDirection: 'row' }]}>
        
        {isWebLarge && renderSidebar()}

        <View style={styles.mainContent}>
          {renderHeader()}
          
          <View style={styles.mainScrollArea}>
            {hasSearched ? renderResults() : renderInitialState()}
          </View>
          
          {renderSuggestionsDropdown()}
          
          {/* Modal de filtres */}
          <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
            {/* Keeping modal content intact */}
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
              <View style={{ backgroundColor: palette.bg, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: SPACING.xl, paddingBottom: insets.bottom + SPACING.xl, maxHeight: '90%' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xl }}>
                  <Text style={{ fontSize: FONT_SIZE.xl, fontWeight: '700', color: palette.text }}>Filtres avancés</Text>
                  <TouchableOpacity onPress={() => setShowFilters(false)} style={{ padding: SPACING.xs, backgroundColor: palette.card, borderRadius: RADIUS.full }}>
                    <Ionicons name="close" size={20} color={palette.text} />
                  </TouchableOpacity>
                </View>
                <View style={{ marginBottom: SPACING.xl }}>
                  <Text style={{ fontSize: FONT_SIZE.md, fontWeight: '600', color: palette.text, marginBottom: SPACING.md }}>Fourchette de prix (FCA)</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}>
                    <View style={{ flex: 1, backgroundColor: palette.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: palette.border, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? SPACING.md : 0 }}>
                      <TextInput placeholder="Min" placeholderTextColor={palette.textMuted} style={{ color: palette.text, fontSize: FONT_SIZE.md, height: 44 }} keyboardType="numeric" value={tempMinPrice} onChangeText={setTempMinPrice} />
                    </View>
                    <Text style={{ color: palette.textMuted, fontSize: FONT_SIZE.lg }}>-</Text>
                    <View style={{ flex: 1, backgroundColor: palette.card, borderRadius: RADIUS.md, borderWidth: 1, borderColor: palette.border, paddingHorizontal: SPACING.md, paddingVertical: Platform.OS === 'ios' ? SPACING.md : 0 }}>
                      <TextInput placeholder="Max" placeholderTextColor={palette.textMuted} style={{ color: palette.text, fontSize: FONT_SIZE.md, height: 44 }} keyboardType="numeric" value={tempMaxPrice} onChangeText={setTempMaxPrice} />
                    </View>
                  </View>
                </View>
                <View style={{ marginBottom: SPACING.xl }}>
                  <Text style={{ fontSize: FONT_SIZE.md, fontWeight: '600', color: palette.text, marginBottom: SPACING.md }}>Note minimale</Text>
                  <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <TouchableOpacity key={star} onPress={() => setTempMinRating(star === tempMinRating ? 0 : star)} style={{ flex: 1, height: 44, borderRadius: RADIUS.md, backgroundColor: tempMinRating >= star ? palette.accent + '15' : palette.card, borderWidth: 1, borderColor: tempMinRating >= star ? palette.accent : palette.border, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={tempMinRating >= star ? "star" : "star-outline"} size={20} color={tempMinRating >= star ? palette.accent : palette.textMuted} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md }}>
                  <TouchableOpacity style={{ flex: 1, paddingVertical: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border, alignItems: 'center' }} onPress={() => { setTempMinPrice(''); setTempMaxPrice(''); setTempMinRating(0); setMinPrice(''); setMaxPrice(''); setMinRating(0); setShowFilters(false); }}>
                    <Text style={{ fontSize: FONT_SIZE.md, fontWeight: '600', color: palette.text }}>Réinitialiser</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ flex: 2, paddingVertical: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: palette.accent, alignItems: 'center' }} onPress={() => { setMinPrice(tempMinPrice); setMaxPrice(tempMaxPrice); setMinRating(tempMinRating); setShowFilters(false); }}>
                    <Text style={{ fontSize: FONT_SIZE.md, fontWeight: '700', color: 'white' }}>Appliquer les filtres</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

        </View>
      </View>
    </View>
  );
`;

code = code.replace(/return \(\n\s*<View style=\{styles\.flexContainer\}>[\s\S]*?<\/View>\n\s*\);\n\s*\};\n\s*function createClientSearchStyles/, newRender + '\n};\n\nfunction createClientSearchStyles');

// 4. Update Header Layout to remove absolute positioning
const newHeader = `
  const renderHeader = () => (
    <View style={styles.pageHeader}>
      <View style={styles.headerTitles}>
        <Text style={styles.pageTitle}>
          {selectedCategory ? selectedCategory : (searchQuery ? 'Résultats de recherche' : 'Tous les produits')}
        </Text>
        <Text style={styles.breadcrumb}>
          Accueil / <Text style={styles.breadcrumbAccent}>{selectedCategory ? selectedCategory : 'Produits'}</Text>
          {activeSidebarSubcategory && <Text> / <Text style={styles.breadcrumbAccent}>Sous-catégorie</Text></Text>}
        </Text>
      </View>
      
      <View style={styles.headerSearchArea}>
        <SearchBar
          value={searchQuery}
          onChangeText={handleSearchChange}
          onSubmitEditing={handleSearchSubmit}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onClear={handleClearSearch}
          placeholder="Rechercher..."
          style={styles.searchBar}
          autoFocus={false}
          showCancelButton={false}
          onCancel={() => {
            setIsFocused(false);
            Keyboard.dismiss();
          }}
        />
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => {
            setTempMinPrice(minPrice);
            setTempMaxPrice(maxPrice);
            setTempMinRating(minRating);
            setShowFilters(true);
          }}
        >
          <Ionicons name="options-outline" size={22} color={(minPrice || maxPrice || minRating > 0) ? 'white' : palette.text} />
          {(minPrice || maxPrice || minRating > 0) && (
            <View style={styles.filterDot} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
`;
code = code.replace(/const renderHeader = \(\) => \([\s\S]*?<\/Animated\.View>\n\s*\);/, newHeader);

// 5. Add Sidebar Styles
const newStyles = `
    appContainer: {
      flex: 1,
      width: '100%',
    },
    sidebar: {
      width: 280,
      backgroundColor: palette.bg,
      borderRightWidth: 1,
      borderRightColor: palette.border,
      paddingVertical: SPACING.xl,
      paddingHorizontal: SPACING.lg,
      flexShrink: 0,
      zIndex: 10,
    },
    sidebarHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.xxl,
      paddingBottom: SPACING.md,
      borderBottomWidth: 2,
      borderBottomColor: palette.border,
    },
    sidebarLogo: {
      fontSize: 28,
      fontWeight: 'bold',
      color: palette.text,
    },
    sidebarLogoAccent: {
      color: palette.accent,
    },
    sidebarTitle: {
      fontSize: FONT_SIZE.lg,
      fontWeight: '600',
      color: palette.text,
      marginBottom: SPACING.md,
      paddingHorizontal: SPACING.xs,
    },
    sidebarScroll: {
      flex: 1,
    },
    categoryList: {
      gap: SPACING.xs,
    },
    sidebarCategoryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.md,
      borderRadius: RADIUS.lg,
      gap: SPACING.md,
      backgroundColor: 'transparent',
    },
    sidebarCategoryItemActive: {
      backgroundColor: palette.accent,
      ...shadows.small,
    },
    sidebarCategoryIcon: {
      width: 32,
      height: 32,
      borderRadius: RADIUS.md,
      backgroundColor: palette.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sidebarCategoryIconActive: {
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    sidebarCategoryName: {
      fontSize: FONT_SIZE.md,
      fontWeight: '500',
      color: palette.textSoft,
      flex: 1,
    },
    sidebarCategoryNameActive: {
      color: 'white',
      fontWeight: '600',
    },
    sidebarSubcategoryContainer: {
      marginLeft: SPACING.md,
      paddingLeft: SPACING.md,
      borderLeftWidth: 2,
      borderLeftColor: palette.border,
      marginTop: SPACING.xs,
      marginBottom: SPACING.sm,
      gap: 2,
    },
    sidebarSubcategoryItem: {
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderRadius: RADIUS.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    sidebarSubcategoryItemActive: {
      backgroundColor: palette.accent,
    },
    sidebarSubcategoryName: {
      fontSize: FONT_SIZE.sm,
      color: palette.textMuted,
      flex: 1,
    },
    sidebarSubcategoryNameActive: {
      color: 'white',
      fontWeight: '600',
    },
    mainContent: {
      flex: 1,
      backgroundColor: palette.bg,
      position: 'relative',
    },
    pageHeader: {
      backgroundColor: palette.card,
      borderRadius: RADIUS.xl,
      padding: SPACING.xl,
      margin: SPACING.lg,
      flexDirection: Platform.OS === 'web' && Dimensions.get('window').width > 600 ? 'row' : 'column',
      justifyContent: 'space-between',
      alignItems: Platform.OS === 'web' && Dimensions.get('window').width > 600 ? 'center' : 'stretch',
      gap: SPACING.md,
      ...shadows.medium,
    },
    headerTitles: {
      gap: 4,
    },
    pageTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: palette.text,
    },
    breadcrumb: {
      fontSize: FONT_SIZE.sm,
      color: palette.textMuted,
    },
    breadcrumbAccent: {
      color: palette.accent,
    },
    headerSearchArea: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    searchBar: {
      width: Platform.OS === 'web' && Dimensions.get('window').width > 600 ? 300 : '100%',
      backgroundColor: palette.bg,
      borderRadius: 30,
      borderWidth: 1,
      borderColor: palette.border,
      marginTop: 0,
      shadowColor: 'transparent',
      elevation: 0,
    },
    filterButton: {
      width: 44,
      height: 44,
      borderRadius: RADIUS.full,
      backgroundColor: palette.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: palette.border,
    },
    filterDot: {
      position: 'absolute',
      top: -2,
      right: -2,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: palette.danger,
      borderWidth: 2,
      borderColor: palette.card,
    },
    mainScrollArea: {
      flex: 1,
    },
`;

code = code.replace(/return StyleSheet\.create\({/, 'return StyleSheet.create({' + newStyles);

// Remove the old paddingTop from resultsContainer since header is no longer absolute
code = code.replace(/resultsContainer: \{\n\s*flex: 1,\n\s*paddingTop: 100, \/\/ Espace pour le header fixe\n\s*\},/, 'resultsContainer: {\n    flex: 1,\n  },');
code = code.replace(/initialContainer: \{\n\s*flex: 1,\n\s*paddingTop: 100, \/\/ Espace pour le header fixe\n\s*\},/, 'initialContainer: {\n    flex: 1,\n  },');

// Hide horizontal categories section in initial view (since it's in the sidebar now) if on web large
code = code.replace(/\{(\/\* Catégories populaires \*\/[\s\S]*?<\/View>)\}/, 
  `{isWebLarge ? null : ($1)}` // wait, we don't have isWebLarge inside renderInitialState
);
// We will just do it inside the JS string
const initialStateMod = `
  const renderInitialState = () => {
    const isWebLarge = Platform.OS === 'web' && width > 768;
    return (
    <Animated.ScrollView
`;
code = code.replace(/const renderInitialState = \(\) => \(\n\s*<Animated\.ScrollView/, initialStateMod);

code = code.replace(/\{\/\* Catégories populaires \*\/\}/, '{!isWebLarge && (<>\n{/* Catégories populaires */}');
code = code.replace(/<\/View>\n\s*\{\/\* Suggestions \*\/\}/, '</View>\n</>)}\n\n      {/* Suggestions */}');

fs.writeFileSync(filePath, code);
console.log('Done rewriting screen layout');
