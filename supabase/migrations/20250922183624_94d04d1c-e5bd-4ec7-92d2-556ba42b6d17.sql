-- Add pendency fields to installations table
ALTER TABLE public.installations 
ADD COLUMN pendencia_tipo text CHECK (pendencia_tipo IN ('cliente', 'fornecedor', 'projetista')),
ADD COLUMN pendencia_descricao text;

-- Add comment for clarity
COMMENT ON COLUMN public.installations.pendencia_tipo IS 'Tipo de pendência: cliente, fornecedor ou projetista';
COMMENT ON COLUMN public.installations.pendencia_descricao IS 'Descrição detalhada da pendência';