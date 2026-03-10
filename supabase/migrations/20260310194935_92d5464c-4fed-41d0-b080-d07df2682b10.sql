
-- Reset all restoration data on gastos_menores
UPDATE gastos_menores 
SET restaurada = false, restaurada_en = NULL, restaurada_por = NULL, restaurada_razon = NULL 
WHERE restaurada = true;

-- Reset restoration data on projects caja_menor JSONB
UPDATE projects
SET caja_menor = (
  SELECT jsonb_agg(
    item - 'restaurada' - 'restauradaPor' - 'restauradaEn' - 'restauradaRazon'
    || jsonb_build_object('restaurada', false)
  )
  FROM jsonb_array_elements(caja_menor) AS item
)
WHERE caja_menor != '[]'::jsonb
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(caja_menor) AS item
    WHERE (item->>'restaurada')::boolean = true
  );

-- Reset restoration data on projects legalizacion JSONB
UPDATE projects
SET legalizacion = (
  SELECT jsonb_agg(
    item - 'restaurada' - 'restauradaPor' - 'restauradaEn' - 'restauradaRazon'
    || jsonb_build_object('restaurada', false)
  )
  FROM jsonb_array_elements(legalizacion) AS item
)
WHERE legalizacion IS NOT NULL 
  AND legalizacion != '[]'::jsonb
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(legalizacion) AS item
    WHERE (item->>'restaurada')::boolean = true
  );
