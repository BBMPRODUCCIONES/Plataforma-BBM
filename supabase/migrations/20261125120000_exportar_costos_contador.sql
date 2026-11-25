-- Fabian Mancipe (contadorbbm@gmail.com) puede exportar costos y sacar el informe de ventas.
create or replace function public.puede_exportar_costos(p_email text)
returns boolean
language sql
immutable
set search_path = public
as $f$
  select lower(trim(coalesce(p_email, ''))) = any (array[
    'auxbbm@gmail.com',
    'abraham.varela@bbmproducciones.com.co',
    'gerencia.administrativa@bbmproducciones.com.co',
    'contabilidadbbm@gmail.com',
    'bayron.bocanegra@bbmproducciones.com.co',
    'administrativo@bbmproducciones.com.co',
    'contadorbbm@gmail.com'
  ]);
$f$;
