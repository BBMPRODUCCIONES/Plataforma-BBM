import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileContent, fileType, fileName } = await req.json();
    
    console.log(`Processing file: ${fileName}, type: ${fileType}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Prepare the message content based on file type
    let messageContent: any[];
    
    if (fileType.startsWith('image/') || fileType === 'application/pdf') {
      // For images and PDFs, send as image with base64
      messageContent = [
        {
          type: "text",
          text: `Analiza esta cotización, Orden de Compra o factura y extrae los siguientes valores monetarios:

1. **Ingreso Bruto**: El valor del producto o servicio SIN impuestos. Busca:
   - "Total Bruto"
   - "Subtotal"
   - "Base"
   - "Neto"
   - "Valor antes de IVA"
   - "Base gravable"

2. **Ingreso Total**: El valor TOTAL incluyendo impuestos y todos los cargos. Busca:
   - "Total a Pagar"
   - "Total"
   - "Gran Total"
   - "Valor Total"
   - "Total con IVA"

IMPORTANTE:
- Extrae los números SIN símbolos de moneda (solo el número)
- Si hay varios valores, usa el que corresponda a "Total Bruto" para ingreso bruto y "Total a Pagar" para ingreso total
- Si no puedes identificar claramente un valor, devuelve null para ese campo
- Los valores deben ser números decimales (ejemplo: 1500000.00)

Responde ÚNICAMENTE con un JSON válido en este formato exacto:
{
  "ingresoBruto": <número o null>,
  "ingresoTotal": <número o null>,
  "moneda": "<código de moneda detectada como COP, USD, EUR>",
  "confianza": "<alta, media, baja>",
  "detallesExtraidos": "<breve descripción de lo que encontraste>"
}`
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
          text: `Analiza el siguiente contenido de una cotización, Orden de Compra o factura (archivo: ${fileName}) y extrae los valores monetarios:

${fileContent}

Extrae:
1. **Ingreso Bruto**: El valor del producto o servicio SIN impuestos. Busca: "Total Bruto", "Subtotal", "Base", "Neto", "Valor antes de IVA"
2. **Ingreso Total**: El valor TOTAL incluyendo impuestos. Busca: "Total a Pagar", "Total", "Gran Total", "Valor Total"

IMPORTANTE:
- Los valores deben ser números sin símbolos de moneda
- Si hay varios valores, usa "Total Bruto" para ingreso bruto y "Total a Pagar" para ingreso total
- Si no puedes identificar claramente un valor, devuelve null

Responde ÚNICAMENTE con un JSON válido en este formato exacto:
{
  "ingresoBruto": <número o null>,
  "ingresoTotal": <número o null>,
  "moneda": "<código de moneda detectada como COP, USD, EUR>",
  "confianza": "<alta, media, baja>",
  "detallesExtraidos": "<breve descripción de lo que encontraste>"
}`
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
          error: 'Límite de solicitudes excedido. Intenta de nuevo en unos minutos.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
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
