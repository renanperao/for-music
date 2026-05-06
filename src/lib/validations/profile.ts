import { z } from 'zod';

export const updateProfileSchema = z
  .object({
    full_name: z.string().trim().min(2).max(120).optional(),
    role: z.enum(['contractor', 'musician', 'both']).optional(),
    bio: z.string().trim().max(2000).nullable().optional(),
    avatar_url: z.string().url().max(500).nullable().optional(),
    pix_key: z.string().trim().min(3).max(140).nullable().optional(),
    pix_key_type: z.enum(['cpf', 'cnpj', 'email', 'phone', 'evp']).nullable().optional(),
  })
  .strict()
  .refine(
    (v) => {
      // pix_key e pix_key_type devem caminhar juntos (ambos null ou ambos preenchidos)
      const keyDefined = v.pix_key !== undefined && v.pix_key !== null;
      const typeDefined = v.pix_key_type !== undefined && v.pix_key_type !== null;
      // Se ambos foram explicitamente fornecidos, têm que combinar em "definido"
      if (v.pix_key !== undefined || v.pix_key_type !== undefined) {
        return keyDefined === typeDefined;
      }
      return true;
    },
    {
      message: 'pix_key e pix_key_type devem ser fornecidos juntos',
      path: ['pix_key'],
    },
  );

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
