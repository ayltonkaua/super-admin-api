/**
 * JWT Verification for Super Admin
 */

import { createHmac } from 'crypto';

interface JWTPayload {
    sub: string;
    email?: string;
    role?: string;
    exp?: number;
}

function base64UrlDecode(str: string): string {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return Buffer.from(str, 'base64').toString('utf8');
}

export function verifyJWT(token: string, secret: string): JWTPayload | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const [headerB64, payloadB64, signatureB64] = parts;

        // Verify signature
        const signature = createHmac('sha256', secret)
            .update(`${headerB64}.${payloadB64}`)
            .digest('base64url');

        if (signature !== signatureB64) return null;

        // Decode payload
        const payload = JSON.parse(base64UrlDecode(payloadB64)) as JWTPayload;

        // Check expiration
        if (payload.exp && Date.now() >= payload.exp * 1000) return null;

        return payload;
    } catch {
        return null;
    }
}

export function decodeJWT(token: string): JWTPayload | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        return JSON.parse(base64UrlDecode(parts[1])) as JWTPayload;
    } catch {
        return null;
    }
}
