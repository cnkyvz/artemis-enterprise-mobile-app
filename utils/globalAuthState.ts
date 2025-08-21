// utils/globalAuthState.ts
class GlobalAuthState {
    private isInitialized: boolean = false;
    private isCheckingAuth: boolean = false;
    private lastCheckTime: number = 0;
    private readonly checkCooldown: number = 5000; // 5 saniye cooldown
   
    setInitialized(value: boolean): void {
      this.isInitialized = value;
      console.log('🔄 Global auth initialized:', value);
    }
   
    canCheckAuth(): boolean {
      const now = Date.now();
      const timeSinceLastCheck = now - this.lastCheckTime;
      
      if (this.isCheckingAuth) {
        console.log('⚠️ Auth kontrolü zaten devam ediyor, atlanıyor');
        return false;
      }
      
      if (this.isInitialized && timeSinceLastCheck < this.checkCooldown) {
        console.log(`⚠️ Auth kontrolü çok yakın zamanda yapıldı (${timeSinceLastCheck}ms), atlanıyor`);
        return false;
      }
      
      return true;
    }
   
    startAuthCheck(): void {
      this.isCheckingAuth = true;
      this.lastCheckTime = Date.now();
      console.log('🚀 Auth kontrolü başlatılıyor...');
    }
   
    finishAuthCheck(): void {
      this.isCheckingAuth = false;
      this.isInitialized = true;
      console.log('✅ Auth kontrolü tamamlandı');
    }
   
    reset(): void {
      this.isInitialized = false;
      this.isCheckingAuth = false;
      this.lastCheckTime = 0;
      console.log('🔄 Global auth state resetlendi');
    }
   }
   
   const globalAuthState = new GlobalAuthState();
   export default globalAuthState;