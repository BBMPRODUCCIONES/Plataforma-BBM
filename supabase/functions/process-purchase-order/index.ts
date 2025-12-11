import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Allowed MIME types for file processing
const allowedFileTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

// Schema validation for purchase order processing
const purchaseOrderSchema = z.object({
  fileContent: z.string()
    .min(1, "Contenido del archivo es requerido")
    .max(10 * 1024 * 1024, "El archivo es demasiado grande (máximo 10MB)"), // Base64 ~10MB max
  fileType: z.string()
    .refine(
      (val) => allowedFileTypes.some(t => val.startsWith(t.split('/')[0]) || val === t),
      { message: "Tipo de archivo no permitido. Use: imagen, PDF o Excel" }
    ),
  fileName: z.string()
    .min(1, "Nombre del archivo es requerido")
    .max(255, "Nombre del archivo muy largo")
    .regex(/^[a-zA-Z0-9._\- ]+$/, "Nombre de archivo contiene caracteres inválidos"),
});

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check - verify user is logged in
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado - Se requiere autenticación' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado - Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Authenticated user: ${user.email}`);

    // Parse and validate request body
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Body de la petición inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate with zod schema
    const validationResult = purchaseOrderSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => e.message).join(', ');
      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { fileContent, fileType, fileName } = validationResult.data;
    
    console.log(`Processing file: ${fileName}, type: ${fileType}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Common prompt for extraction
    const extractionPrompt = `Analiza esta cotización, Orden de Compra o factura y extrae:

## 1. VALORES MONETARIOS:

1. **Ingreso Bruto**: El valor del producto o servicio SIN impuestos. Busca:
   - "Total Bruto", "Subtotal", "Base", "Neto", "Valor antes de IVA", "Base gravable"

2. **Ingreso Total**: El valor TOTAL incluyendo impuestos. Busca:
   - "Total a Pagar", "Total", "Gran Total", "Valor Total", "Total con IVA"

## 2. ÍTEMS DE INVENTARIO:

Extrae TODOS los ítems/productos/servicios listados en el documento. Hay dos posibles formatos:

**Formato A - Una fila por ítem:**
La cotización tiene una tabla con columnas como: Ítem | Descripción | Cantidad
Por cada fila, extrae la descripción y cantidad.

**Formato B - Múltiples ítems en una celda:**
Una celda de "Descripción" contiene varias líneas, cada una con formato:
"<cantidad> <descripción del ítem>"
Ejemplo:
2 Cabina de sonido Bose L1 Compact
1 Consola de sonido analoga
3 Microfono inalambrico

Para cada línea: el primer número es la cantidad, el resto es la descripción.

IMPORTANTE:
- Extrae los números monetarios SIN símbolos de moneda
- Si no identificas un valor, devuelve null
- Extrae TODOS los ítems que encuentres, sin importar el formato
- La cantidad debe ser un número (ej: 2, 1.5, 10)
- La descripción/material debe ser texto descriptivo del ítem

Responde ÚNICAMENTE con un JSON válido en este formato exacto:
{
  "ingresoBruto": <número o null>,
  "ingresoTotal": <número o null>,
  "moneda": "<código de moneda: COP, USD, EUR>",
  "confianza": "<alta, media, baja>",
  "detallesExtraidos": "<breve descripción de lo que encontraste>",
  "inventarioItems": [
    { "material": "<descripción del ítem>", "cantidad": <número> },
    { "material": "<descripción del ítem>", "cantidad": <número> }
  ]
}

Si no encuentras ítems de inventario, devuelve "inventarioItems": []`;

    // Prepare the message content based on file type
    let messageContent: any[];
    
    if (fileType.startsWith('image/') || fileType === 'application/pdf') {
      // For images and PDFs, send as image with base64
      messageContent = [
        {
          type: "text",
          text: extractionPrompt
        },
        {
          type: "image_url",
          image_url: {
            url: fileContent
          }
        }
      ];
    } else {
      // For Excel or text content, send as text
      messageContent = [
        {
          type: "text",
          text: `${extractionPrompt}\n\nContenido del archivo (${fileName}):\n\n${fileContent}`
        }
      ];
    }

    console.log('Calling Lovable AI Gateway...');
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: messageContent
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Límite de solicitudes excedido. Intenta de nuevo en unos minutos.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Créditos insuficientes. Agrega créditos en Configuración.' 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;
    
    console.log('AI Response:', aiResponse);

    if (!aiResponse) {
      throw new Error('No response from AI');
    }

    // Parse the JSON response from AI
    let extractedData;
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      extractedData = {
        ingresoBruto: null,
        ingresoTotal: null,
        moneda: 'COP',
        confianza: 'baja',
        detallesExtraidos: 'No se pudo extraer información del documento'
      };
    }

    console.log('Extracted data:', extractedData);

    return new Response(JSON.stringify({
      success: true,
      data: extractedData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing purchase order:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
