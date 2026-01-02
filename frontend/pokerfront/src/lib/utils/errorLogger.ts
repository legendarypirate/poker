/**
 * Production error logging utility
 * Helps track and debug errors in production environment
 */

import { API_URL } from '@/lib/config';

interface ErrorContext {
  error: any;
  step: 'firebase_auth' | 'backend_api' | 'unknown';
  userId?: string;
  email?: string;
  timestamp: string;
  userAgent: string;
  url: string;
  additionalData?: Record<string, any>;
}

/**
 * Logs error to console with detailed information
 */
export function logError(context: ErrorContext) {
  const {
    error,
    step,
    userId,
    email,
    timestamp,
    userAgent,
    url,
    additionalData,
  } = context;

  const errorDetails = {
    step,
    timestamp,
    url,
    userAgent,
    userId,
    email,
    error: {
      code: error?.code,
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      response: error?.response
        ? {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data,
            url: error.config?.url,
            method: error.config?.method,
          }
        : undefined,
      request: error?.request ? 'Request object exists' : undefined,
    },
    ...additionalData,
  };

  console.error(`[${step.toUpperCase()}] Error Details:`, errorDetails);

  // In production, you might want to send this to a logging service
  // For now, we'll also try to send to backend if available
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    sendErrorToBackend(errorDetails).catch((err) => {
      console.error('Failed to send error to backend:', err);
    });
  }

  return errorDetails;
}

/**
 * Sends error to backend for logging (optional)
 */
async function sendErrorToBackend(errorDetails: any) {
  try {
    // Only send if backend endpoint exists
    await fetch(`${API_URL}/api/logs/error`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...errorDetails,
        environment: process.env.NODE_ENV,
        appVersion: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      }),
    }).catch(() => {
      // Silently fail if endpoint doesn't exist
    });
  } catch (err) {
    // Silently fail - don't break the app if logging fails
  }
}

/**
 * Extracts user-friendly error message from error object
 */
export function getErrorMessage(error: any, step: 'firebase_auth' | 'backend_api' | 'unknown'): string {
  // Firebase Auth errors
  if (error?.code && step === 'firebase_auth') {
    const errorMessages: Record<string, string> = {
      'auth/popup-closed-by-user': 'Нэвтрэх цонхыг хаасан байна',
      'auth/popup-blocked': 'Нэвтрэх цонхыг блоклодсон байна. Блоклолтыг арилгана уу',
      'auth/cancelled-popup-request': 'Нэвтрэх цонхыг дахин нээх гэж байна',
      'auth/network-request-failed': 'Сүлжээний алдаа. Интернэт холболтоо шалгана уу',
      'auth/unauthorized-domain': 'Энэ домэнд зөвшөөрөгдөөгүй байна',
      'auth/operation-not-allowed': 'Google нэвтрэх идэвхжээгүй байна',
      'auth/account-exists-with-different-credential': 'Энэ имэйлээр өөр аргаар бүртгэлтэй байна',
      'auth/invalid-credential': 'Хүчингүй нэвтрэх мэдээлэл',
      'auth/user-disabled': 'Хэрэглэгчийн эрх идэвхгүй болсон байна',
      'auth/user-not-found': 'Хэрэглэгч олдсонгүй',
      'auth/wrong-password': 'Нууц үг буруу байна',
      'auth/too-many-requests': 'Хэт олон оролдлого. Түр хүлээнэ үү',
    };

    return errorMessages[error.code] || `Google нэвтрэх амжилтгүй (${error.code})`;
  }

  // Backend API errors
  if (error?.response && step === 'backend_api') {
    const backendError = error.response?.data?.message || error.response?.data?.error;
    if (backendError) {
      return backendError;
    }

    const statusMessages: Record<number, string> = {
      400: 'Хүсэлт буруу байна',
      401: 'Нэвтрэх эрхгүй байна',
      403: 'Хандах эрхгүй байна',
      404: 'Сервис олдсонгүй',
      500: 'Серверийн алдаа гарлаа',
      502: 'Серверт холбогдох боломжгүй',
      503: 'Сервис түр хугацаанд ашиглах боломжгүй',
    };

    return statusMessages[error.response.status] || `Серверийн алдаа (${error.response.status})`;
  }

  // Generic error with message
  if (error?.message) {
    return error.message;
  }

  // Default fallback
  return step === 'firebase_auth'
    ? 'Google нэвтрэх амжилтгүй'
    : step === 'backend_api'
    ? 'Серверийн алдаа гарлаа'
    : 'Алдаа гарлаа';
}

