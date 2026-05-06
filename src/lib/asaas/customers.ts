// Cobranças exigem um Customer. Criamos sob demanda no checkout.

import { asaas } from '@/lib/asaas/client';

export type AsaasCustomer = {
  id: string;
  name: string;
  email: string;
  cpfCnpj?: string;
  mobilePhone?: string;
  externalReference?: string;
};

export type CreateCustomerInput = {
  name: string;
  email: string;
  cpfCnpj?: string;       // opcional no sandbox; obrigatório em produção
  mobilePhone?: string;
  externalReference?: string; // usamos o user.id da plataforma
};

export function createAsaasCustomer(input: CreateCustomerInput) {
  return asaas.post<AsaasCustomer>('/customers', input);
}

export function getAsaasCustomer(id: string) {
  return asaas.get<AsaasCustomer>(`/customers/${id}`);
}
