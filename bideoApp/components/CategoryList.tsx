import React from 'react';
import { ScrollView, Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Colors from '../constants/Colors';
import { hapticSelection } from '../utils/haptics';

interface CategoryListProps {
  categories?: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

const CategoryList: React.FC<CategoryListProps> = ({ categories = ['All'], selectedCategory, onSelectCategory }) => {
  const router = useRouter();

  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false} 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.leaderboardButton}
        onPress={() => {
          hapticSelection();
          router.push('/leaderboard');
        }}
      >
        <Ionicons name="podium" size={17} color={Colors.primary} />
      </TouchableOpacity>

      {categories.map((category) => (
        <TouchableOpacity
          key={category}
          activeOpacity={0.8}
          style={[
            styles.categoryButton,
            selectedCategory === category && styles.selectedCategoryButton,
          ]}
          onPress={() => { hapticSelection(); onSelectCategory(category); }}
        >
          <Text
            style={[
              styles.categoryText,
              selectedCategory === category && styles.selectedCategoryText,
            ]}
          >
            {category}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    maxHeight: 60,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  contentContainer: {
    paddingHorizontal: 12,
    alignItems: 'center',
    paddingVertical: 10,
  },
  leaderboardButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF4EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1.2,
    borderColor: '#FFD7B2',
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F2F3F5',
    marginRight: 8,
    height: 36,
    justifyContent: 'center',
  },
  selectedCategoryButton: {
    backgroundColor: Colors.primary,
  },
  categoryText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  selectedCategoryText: {
    color: Colors.white,
  },
});

export default CategoryList;
