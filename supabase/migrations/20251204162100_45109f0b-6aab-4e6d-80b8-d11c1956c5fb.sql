-- Crear bucket para cotizaciones de proveedores
INSERT INTO storage.buckets (id, name, public) VALUES ('supplier-cotizaciones', 'supplier-cotizaciones', true);

-- Policy para ver archivos
CREATE POLICY "Authenticated users can view supplier files" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'supplier-cotizaciones');

-- Policy para subir archivos
CREATE POLICY "Authenticated users can upload supplier files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'supplier-cotizaciones');

-- Policy para eliminar archivos
CREATE POLICY "Authenticated users can delete supplier files" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'supplier-cotizaciones');