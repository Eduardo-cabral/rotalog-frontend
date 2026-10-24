
import { createContext } from "react";

import type {
    AuthUser,
    LoginCredentials,
} from "../../services/auth.service";

export type AuthContextValue = {
    user: AuthUser | null;
    isLoading: boolean;
    sessionError: string;
    sessionNotice: string;
    isAuthenticated: boolean;
    login: (credentials: LoginCredentials) => Promise<AuthUser>;
    logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(
    null
);
