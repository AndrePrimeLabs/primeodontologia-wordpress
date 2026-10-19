// @ts-nocheck
import React from 'react';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const AccessDeniedError = ({ requiredRole = 'administrador', pageTitle = '' }) => {
  const { logout } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="max-w-md w-full p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Acesso Restrito
        </h1>
        
        <p className="text-slate-600 dark:text-slate-300 text-sm mb-6 leading-relaxed">
          {pageTitle ? (
            <>Você não possui permissão para acessar a área <strong>{pageTitle}</strong>.</>
          ) : (
            <>Sua conta atual não possui o nível de permissão necessário ({requiredRole}) para acessar este recurso.</>
          )}
        </p>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs text-slate-600 dark:text-slate-400 text-left mb-6 space-y-2 border border-slate-100 dark:border-slate-700/50">
          <p className="font-semibold text-slate-700 dark:text-slate-300">O que você pode fazer:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Retorne à página inicial ou selecione outro módulo no menu</li>
            <li>Solicite liberação de acesso ao administrador da clínica</li>
            <li>Se conectou com outra conta, encerre a sessão atual</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => window.location.href = './'}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-medium text-sm hover:opacity-90 transition-opacity"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Início
          </button>
          <button
            onClick={() => logout()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccessDeniedError;
