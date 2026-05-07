import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/app/guards/AuthContext';
import { vendorOnboardingApi } from '@/app/services/vendorOnboardingApi';
import { toast } from 'sonner';

const VAPID_PUBLIC_KEY = 'BGyRryTwl_6PcY_6KEI2dNSdV5UXYnnT6SnMUzp7pC0vs2lKTAWCr0bVlk4ojiKHFJD6GID_fAiHY2wNEBKczvA';

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      toast.error('This browser does not support push notifications');
      return false;
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    return result === 'granted';
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    if (permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) return false;
    }

    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        toast.error('Service worker not registered');
        return false;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      const subscriptionJson = subscription.toJSON();
      await vendorOnboardingApi.registerPushSubscription(user.id, {
        vendorId: user.id,
        endpoint: subscriptionJson.endpoint!,
        p256dh: subscriptionJson.keys!.p256dh!,
        auth: subscriptionJson.keys!.auth!
      });

      setIsSubscribed(true);
      toast.success('Push notifications enabled');
      return true;
    } catch (error) {
      console.error('Push subscription error:', error);
      toast.error('Failed to enable push notifications');
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, permission, requestPermission]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!user) return;

    setLoading(true);
    try {
      await vendorOnboardingApi.unregisterPushSubscription(user.id);

      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
        }
      }

      setIsSubscribed(false);
      toast.success('Push notifications disabled');
    } catch (error) {
      console.error('Push unsubscribe error:', error);
      toast.error('Failed to disable push notifications');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const checkSubscription = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      const backendSub = await vendorOnboardingApi.getPushSubscription(user.id);
      setIsSubscribed(backendSub !== null);
    } catch {
      setIsSubscribed(false);
    }
  }, [user]);

  useEffect(() => {
    void checkSubscription();
  }, [checkSubscription]);

  return {
    permission,
    isSubscribed,
    loading,
    requestPermission,
    subscribe,
    unsubscribe,
    checkSubscription
  };
};
