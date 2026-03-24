#!/bin/bash

# Script de nettoyage des console.log dans LibreShop
# Remplace tous les console.log/error/warn par le système d'erreurs centralisé

echo "🧹 Nettoyage des console.log dans les fichiers TypeScript..."

# Liste des fichiers à traiter
FILES=(
    "src/screens/AdminStoresScreen.tsx"
    "src/screens/SellerProductsScreen.tsx"
    "src/screens/SellerEditCollectionScreen.tsx"
    "src/screens/SellerCollectionProductsScreen.tsx"
    "src/screens/SellerOrdersScreen.tsx"
    "src/screens/SellerOrderDetailScreen.tsx"
    "src/screens/AdminUsersScreen.tsx"
    "src/screens/ProductDetailScreen.tsx"
    "src/screens/StoreDetailScreen.tsx"
    "src/screens/ClientOrdersScreen.tsx"
    "src/screens/SellerClientsScreen.tsx"
)

# Fonction pour ajouter l'import errorHandler si nécessaire
add_error_handler_import() {
    local file=$1
    if ! grep -q "errorHandler" "$file"; then
        echo "📦 Ajout import errorHandler dans $file"
        sed -i '1a\
import { errorHandler, ErrorCategory, ErrorSeverity } from '\''../utils/errorHandler'\'';' "$file"
    fi
}

# Fonction pour remplacer les console.error
replace_console_error() {
    local file=$1
    echo "🔄 Traitement de $file..."
    
    # Remplacer console.error('message', error) -> errorHandler.handleDatabaseError(error, 'context')
    sed -i 's/console\.error(\s*['\''\"]\([^'\''\"]*\)['\'\"'],\s*\([^)]*\))/errorHandler.handleDatabaseError(\2, '\''\1'\'')/g' "$file"
    
    # Remplacer console.error(error) -> errorHandler.handle(error, 'context')
    sed -i 's/console\.error(\s*\([^)]*\))/errorHandler.handle(\1, '\''UnknownContext'\'')/g' "$file"
}

# Fonction pour remplacer les console.warn
replace_console_warn() {
    local file=$1
    
    # Remplacer console.warn('message', error) -> errorHandler.handle(error, 'context', ErrorCategory.SYSTEM, ErrorSeverity.LOW)
    sed -i 's/console\.warn(\s*['\''\"]\([^'\''\"]*\)['\'\"'],\s*\([^)]*\))/errorHandler.handle(\2, '\''\1'\'', ErrorCategory.SYSTEM, ErrorSeverity.LOW)/g' "$file"
    
    # Remplacer console.warn(error) -> errorHandler.handle(error, 'context', ErrorCategory.SYSTEM, ErrorSeverity.LOW)
    sed -i 's/console\.warn(\s*\([^)]*\))/errorHandler.handle(\1, '\''UnknownContext'\'', ErrorCategory.SYSTEM, ErrorSeverity.LOW)/g' "$file"
}

# Fonction pour remplacer les console.log
replace_console_log() {
    local file=$1
    
    # Supprimer les console.log de debug
    sed -i '/console\.log.*debug/d' "$file"
    sed -i '/console\.log.*loaded/d' "$file"
    sed -i '/console\.log.*generated/d' "$file"
    
    # Remplacer les console.log utiles
    sed -i 's/console\.log(\s*['\''\"]\([^'\''\"]*\)['\'\"'],\s*\([^)]*\))/\/\/ \1: \2/g' "$file"
    sed -i 's/console\.log(\s*\([^)]*\))/\/\/ Log: \1/g' "$file"
}

# Traiter chaque fichier
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "📁 Traitement: $file"
        add_error_handler_import "$file"
        replace_console_error "$file"
        replace_console_warn "$file"
        replace_console_log "$file"
        echo "✅ $file traité"
    else
        echo "❌ Fichier non trouvé: $file"
    fi
done

echo "🎉 Nettoyage terminé!"
echo "📊 Résumé:"
echo "  - Fichiers traités: ${#FILES[@]}"
echo "  - Imports errorHandler ajoutés automatiquement"
echo "  - console.log/error/warn remplacés"
echo ""
echo "🔍 Vérifiez manuellement les fichiers pour vous assurer que les remplacements sont corrects."
