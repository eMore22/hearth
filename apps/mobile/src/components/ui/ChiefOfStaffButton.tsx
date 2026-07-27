import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'

const ACCENT = '#4FC3F7'

interface ChiefOfStaffButtonProps {
  label?: string
  onPress?: () => void
}

export default function ChiefOfStaffButton({
  label = 'Ask Hearth',
  onPress
}: ChiefOfStaffButtonProps) {
  const handlePress = () => {
    if (onPress) {
      onPress()
    } else {
      router.push('/chief-of-staff')
    }
  }

  return (
    <TouchableOpacity style={styles.button} onPress={handlePress}>
      <Ionicons name="chatbubble-ellipses" size={22} color="#fff" />
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: ACCENT,
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 100
  },
  text: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 15
  }
})
