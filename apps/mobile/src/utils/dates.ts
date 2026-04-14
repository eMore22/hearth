export const formatDate = (dateString: string): string => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export const daysUntil = (dateString: string): number => {
  if (!dateString) return 0
  const target = new Date(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  const diff = target.getTime() - today.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export const isExpired = (dateString: string): boolean => {
  return daysUntil(dateString) < 0
}

export const isExpiringSoon = (dateString: string, thresholdDays: number = 30): boolean => {
  const days = daysUntil(dateString)
  return days >= 0 && days <= thresholdDays
}

export const getRelativeTimeString = (dateString: string): string => {
  const days = daysUntil(dateString)
  if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ago`
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days <= 7) return `in ${days} days`
  if (days <= 30) return `in ${Math.ceil(days / 7)} week${Math.ceil(days / 7) !== 1 ? 's' : ''}`
  return formatDate(dateString)
}