import { useEffect } from 'react';
import { router } from 'expo-router';

export default function ExploreRedirect() {
  useEffect(() => {
    router.replace('/uye-panel');
  }, []);

  return null;
}
