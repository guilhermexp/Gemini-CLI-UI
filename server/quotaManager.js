import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

class QuotaManager {
  constructor() {
    this.quotaFile = path.join(os.homedir(), '.gemini', 'quota-usage.json');
    this.initQuotaFile();
    
    // Daily limits for different models (free tier)
    this.limits = {
      'gemini-2.5-pro': {
        requestsPerMinute: 5,
        requestsPerDay: 25
      },
      'gemini-2.5-flash': {
        requestsPerMinute: 60,
        requestsPerDay: 1000
      }
    };
  }

  async initQuotaFile() {
    try {
      await fs.mkdir(path.dirname(this.quotaFile), { recursive: true });
    } catch (error) {
      console.error('Error creating quota directory:', error);
    }
  }

  // Get current quota usage
  async getUsage() {
    try {
      const data = await fs.readFile(this.quotaFile, 'utf8');
      const usage = JSON.parse(data);
      
      // Check if we need to reset daily counters
      const now = new Date();
      const lastReset = new Date(usage.lastReset || 0);
      
      // Reset at midnight Pacific Time (UTC-8)
      const pacificOffset = -8 * 60; // minutes
      const pacificNow = new Date(now.getTime() + (pacificOffset * 60 * 1000));
      const pacificLastReset = new Date(lastReset.getTime() + (pacificOffset * 60 * 1000));
      
      const shouldReset = pacificNow.getDate() !== pacificLastReset.getDate() || 
                         pacificNow.getMonth() !== pacificLastReset.getMonth() ||
                         pacificNow.getFullYear() !== pacificLastReset.getFullYear();
      
      if (shouldReset) {
        // Reset daily counters
        for (const model in usage.daily) {
          usage.daily[model] = 0;
        }
        usage.lastReset = now.toISOString();
        await this.saveUsage(usage);
      }
      
      return usage;
    } catch (error) {
      // Initialize if file doesn't exist
      const initialUsage = {
        daily: {
          'gemini-2.5-pro': 0,
          'gemini-2.5-flash': 0
        },
        minute: {
          'gemini-2.5-pro': [],
          'gemini-2.5-flash': []
        },
        lastReset: new Date().toISOString()
      };
      await this.saveUsage(initialUsage);
      return initialUsage;
    }
  }

  async saveUsage(usage) {
    try {
      await fs.writeFile(this.quotaFile, JSON.stringify(usage, null, 2));
    } catch (error) {
      console.error('Error saving quota usage:', error);
    }
  }

  // Record a new request
  async recordRequest(model = 'gemini-2.5-flash') {
    const usage = await this.getUsage();
    const now = new Date();
    
    // Initialize if model doesn't exist
    if (!usage.daily[model]) usage.daily[model] = 0;
    if (!usage.minute[model]) usage.minute[model] = [];
    
    // Increment daily counter
    usage.daily[model]++;
    
    // Add to minute tracker
    usage.minute[model].push(now.toISOString());
    
    // Clean up minute tracker (keep only last minute)
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    usage.minute[model] = usage.minute[model].filter(timestamp => 
      new Date(timestamp) > oneMinuteAgo
    );
    
    await this.saveUsage(usage);
    return usage;
  }

  // Check if request would exceed limits
  async canMakeRequest(model = 'gemini-2.5-flash') {
    const usage = await this.getUsage();
    const limits = this.limits[model];
    
    if (!limits) {
      return { canMake: false, reason: 'Unknown model' };
    }
    
    // Check daily limit
    const dailyUsed = usage.daily[model] || 0;
    if (dailyUsed >= limits.requestsPerDay) {
      return { 
        canMake: false, 
        reason: 'Daily limit exceeded',
        dailyUsed,
        dailyLimit: limits.requestsPerDay
      };
    }
    
    // Check minute limit
    const minuteUsed = (usage.minute[model] || []).length;
    if (minuteUsed >= limits.requestsPerMinute) {
      return { 
        canMake: false, 
        reason: 'Rate limit exceeded',
        minuteUsed,
        minuteLimit: limits.requestsPerMinute
      };
    }
    
    return { canMake: true };
  }

  // Get quota status for all models
  async getQuotaStatus() {
    const usage = await this.getUsage();
    const status = {};
    
    for (const model in this.limits) {
      const limits = this.limits[model];
      const dailyUsed = usage.daily[model] || 0;
      const minuteUsed = (usage.minute[model] || []).length;
      
      status[model] = {
        daily: {
          used: dailyUsed,
          limit: limits.requestsPerDay,
          remaining: Math.max(0, limits.requestsPerDay - dailyUsed),
          percentage: Math.round((dailyUsed / limits.requestsPerDay) * 100)
        },
        minute: {
          used: minuteUsed,
          limit: limits.requestsPerMinute,
          remaining: Math.max(0, limits.requestsPerMinute - minuteUsed),
          percentage: Math.round((minuteUsed / limits.requestsPerMinute) * 100)
        }
      };
    }
    
    // Calculate next reset time (midnight Pacific)
    const now = new Date();
    const pacificOffset = -8 * 60; // minutes
    const pacificNow = new Date(now.getTime() + (pacificOffset * 60 * 1000));
    const nextReset = new Date(pacificNow);
    nextReset.setDate(nextReset.getDate() + 1);
    nextReset.setHours(0, 0, 0, 0);
    
    // Convert back to user's timezone
    const nextResetLocal = new Date(nextReset.getTime() - (pacificOffset * 60 * 1000));
    
    return {
      models: status,
      nextReset: nextResetLocal.toISOString(),
      lastUpdated: new Date().toISOString()
    };
  }

  // Estimate time until quota resets
  getTimeUntilReset() {
    const now = new Date();
    const pacificOffset = -8 * 60; // minutes
    const pacificNow = new Date(now.getTime() + (pacificOffset * 60 * 1000));
    const nextReset = new Date(pacificNow);
    nextReset.setDate(nextReset.getDate() + 1);
    nextReset.setHours(0, 0, 0, 0);
    
    const nextResetLocal = new Date(nextReset.getTime() - (pacificOffset * 60 * 1000));
    const msUntilReset = nextResetLocal.getTime() - now.getTime();
    
    const hours = Math.floor(msUntilReset / (1000 * 60 * 60));
    const minutes = Math.floor((msUntilReset % (1000 * 60 * 60)) / (1000 * 60));
    
    return {
      hours,
      minutes,
      totalMs: msUntilReset,
      resetTime: nextResetLocal.toISOString()
    };
  }
}

// Singleton instance
const quotaManager = new QuotaManager();

export default quotaManager;