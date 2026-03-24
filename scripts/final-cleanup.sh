#!/bin/bash

# Script de nettoyage final des console.log restants
# Nettoie tous les console.log/error/warn restants dans tout le projet

echo "🧹 Nettoyage final des console.log restants..."

# Trouver tous les fichiers TypeScript/React avec des console
FILES_WITH_CONSOLE=$(find src -name "*.tsx" -o -name "*.ts" | xargs grep -l "console\.")

echo "📁 Fichiers trouvés avec console: $(echo "$FILES_WITH_CONSOLE" | wc -l)"

# Fonction pour nettoyer un fichier
cleanup_file() {
    local file=$1
    echo "🔄 Nettoyage de $file..."
    
    # Ajouter l'import errorHandler si nécessaire
    if ! grep -q "errorHandler" "$file"; then
        # Trouver la ligne d'import existante et ajouter après
        if grep -q "from.*config/theme" "$file"; then
            sed -i '/from.*config\/theme/a import { errorHandler, ErrorCategory, ErrorSeverity } from '\''../utils/errorHandler'\'';' "$file"
        elif grep -q "from.*supabase" "$file"; then
            sed -i '/from.*supabase/a import { errorHandler, ErrorCategory, ErrorSeverity } from '\''../utils/errorHandler'\'';' "$file"
        fi
    fi
    
    # Remplacements plus agressifs
    sed -i 's/console\.error(\s*['\''\"]\([^'\''\"]*\)['\'\"'],\s*\([^)]*\))/errorHandler.handleDatabaseError(\2, '\''\1'\'')/g' "$file"
    sed -i 's/console\.error(\s*\([^)]*\))/errorHandler.handle(\1, '\''UnknownContext'\'')/g' "$file"
    
    sed -i 's/console\.warn(\s*['\''\"]\([^'\''\"]*\)['\'\"'],\s*\([^)]*\))/errorHandler.handle(\2, '\''\1'\'', ErrorCategory.SYSTEM, ErrorSeverity.LOW)/g' "$file"
    sed -i 's/console\.warn(\s*\([^)]*\))/errorHandler.handle(\1, '\''UnknownContext'\'', ErrorCategory.SYSTEM, ErrorSeverity.LOW)/g' "$file"
    
    # Supprimer les console.log de debug
    sed -i '/console\.log.*\[.*\]/d' "$file"
    sed -i '/console\.log.*called/d' "$file"
    sed -i '/console\.log.*process/d' "$file"
    sed -i '/console\.log.*starting/d' "$file"
    sed -i '/console\.log.*successful/d' "$file"
    
    # Remplacer les console.log utiles
    sed -i 's/console\.log(\s*['\''\"]\([^'\''\"]*\)['\'\"'],\s*\([^)]*\))/\/\/ \1: \2/g' "$file"
    sed -i 's/console\.log(\s*\([^)]*\))/\/\/ Log: \1/g' "$file"
    
    echo "✅ $file nettoyé"
}

# Traiter chaque fichier
for file in $FILES_WITH_CONSOLE; do
    if [ -f "$file" ]; then
        cleanup_file "$file"
    fi
done

echo "🎉 Nettoyage final terminé!"

# Vérification finale
REMAINING=$(find src -name "*.tsx" -o -name "*.ts" | xargs grep -c "console\." | grep -v ":0$" | wc -l)
if [ "$REMAINING" -gt 0 ]; then
    echo "⚠️  Il reste encore $REMAINING fichiers avec des console:"
    find src -name "*.tsx" -o -name "*.ts" | xargs grep -l "console\." | head -5
else
    echo "✅ Tous les console ont été nettoyés!"
fi
