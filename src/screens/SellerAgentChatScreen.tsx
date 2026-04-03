import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Text,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { agentService } from '../services/agentService';
import { useOrdersStore, useStoreStore } from '../store';
import { COLORS, SPACING, RADIUS, FONT_SIZE } from '../config/theme';

interface Message {
  id: string;
  role: 'user' | 'agent';
  text: string;
}

const PREDEFINED_QUESTIONS = [
  "Comment accepter une commande ?",
  "Comment ajouter un produit ?",
  "Astuces pour vendre plus ?"
];

export const SellerAgentChatScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: Date.now().toString(),
      role: 'agent',
      text: "Bonjour ! Je suis ton assistant LibreShop. Comment puis-je t'aider aujourd'hui ?",
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const { store } = useStoreStore();
  const { orders } = useOrdersStore();

  const handleSend = async (text: string = input) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: text.trim() };
    setMessages((prev) => [userMsg, ...prev]);
    setInput('');
    setLoading(true);

    try {
      // Build basic context
      const pendingCount = orders.filter(o => o.status === 'pending').length;
      const totalRevenue = orders
        .filter(o => ['paid', 'shipped', 'delivered'].includes(o.status))
        .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

      const context = `CA actuel: ${totalRevenue} FCFA | Commandes en attente: ${pendingCount} | Boutique ID: ${store?.id || 'Inconnue'}`;

      const answer = await agentService.askAgent(text.trim(), context, store?.id);

      const agentMsg: Message = { id: (Date.now() + 1).toString(), role: 'agent', text: answer };
      setMessages((prev) => [agentMsg, ...prev]);
    } catch (e) {
      const errorMsg: Message = { id: (Date.now() + 1).toString(), role: 'agent', text: "Erreur lors de la communication avec l'assistant." };
      setMessages((prev) => [errorMsg, ...prev]);
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageBubbleWrapper, isUser ? styles.messageBubbleUserWrapper : styles.messageBubbleAgentWrapper]}>
        {!isUser && (
          <View style={styles.agentAvatar}>
            <Ionicons name="sparkles" size={16} color="white" />
          </View>
        )}
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.agentBubble]}>
          <Text style={[styles.messageText, isUser ? styles.userText : styles.agentText]}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Ionicons name="sparkles" size={20} color={COLORS.accent} />
          <Text style={styles.headerTitle}>Assistant IA</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Main Chat Area */}
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />

        {/* Suggestions */}
        {messages.length <= 2 && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>Exemples :</Text>
            <View style={styles.suggestionsRow}>
              {PREDEFINED_QUESTIONS.map((q, idx) => (
                <TouchableOpacity key={idx} style={styles.suggestionPill} onPress={() => handleSend(q)}>
                  <Text style={styles.suggestionText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Posez votre question..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            maxLength={300}
          />
          <TouchableOpacity 
            style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]} 
            onPress={() => handleSend(input)}
            disabled={!input.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Ionicons name="send" size={20} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  headerTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  keyboardAvoid: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  messageBubbleWrapper: {
    flexDirection: 'row',
    marginVertical: SPACING.xs,
    maxWidth: '85%',
    alignItems: 'flex-end',
  },
  messageBubbleUserWrapper: {
    alignSelf: 'flex-end',
  },
  messageBubbleAgentWrapper: {
    alignSelf: 'flex-start',
  },
  agentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  messageBubble: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    flexShrink: 1, // Crucial for text wrapping
  },
  userBubble: {
    backgroundColor: COLORS.accent,
    borderBottomRightRadius: 4,
  },
  agentBubble: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: FONT_SIZE.md,
    lineHeight: 22,
  },
  userText: {
    color: 'white',
  },
  agentText: {
    color: COLORS.text,
  },
  suggestionsContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.bg,
  },
  suggestionsTitle: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  suggestionPill: {
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  suggestionText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.text,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    marginRight: SPACING.sm,
    maxHeight: 100,
    color: COLORS.text,
    fontSize: FONT_SIZE.md,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.border,
  },
});
