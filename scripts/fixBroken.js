const fs = require('fs');
const files = [
  'AddUserModal.tsx',
  'ErrorDisplay.tsx',
  'FollowButton.tsx',
  'LikeButton.tsx',
  'PWAInstallButton.tsx',
  'ValidationMessage.tsx'
];

files.forEach(f => {
  try {
    const path = `src/components/${f}`;
    let content = fs.readFileSync(path, 'utf8');
    
    // Revert getStyles back to StyleSheet.create
    content = content.replace(/const getStyles = \(theme: any\) => \{\n\s*const COLORS = theme\.getColor;\n\s*const SPACING = theme\.spacing;\n\s*const RADIUS = theme\.radius;\n\s*const FONT_SIZE = theme\.fontSize;\n\s*return StyleSheet\.create\(\{/g, 'const styles = StyleSheet.create({');

    // Remove the injected useMemo that shadows 'styles'
    content = content.replace(/\s*const styles = React\.useMemo\(\(\) => typeof getStyles === 'function' \? getStyles\(theme\) : \{\}, \[theme\]\);/g, '');

    fs.writeFileSync(path, content, 'utf8');
    console.log(`Fixed ${f}`);
  } catch (e) {
    console.error(`Error fixing ${f}:`, e);
  }
});
