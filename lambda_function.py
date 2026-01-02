import json
import os
import urllib.request
import urllib.error

OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY')
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

DEMO_API_KEY = os.environ.get('GUEST_AWS_KEY')

def lambda_handler(event, context):
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, x-api-key",
        "Access-Control-Allow-Methods": "OPTIONS,POST"
    }

    if event['httpMethod'] == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps('CORS OK')
        }

    try:

        user_key = event.get('headers', {}).get('x-api-key', '').strip()
        if user_key == DEMO_API_KEY:
            model = "google/gemma-3-4b-it"
        else:
            model = "google/gemma-3-27b-it"   

        body = json.loads(event['body'])
        image_data = body.get('image')  # base64 string

        if not image_data:
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps('No image provided')}

        payload = {
            "model": model,
            "temperature": 0.1, 
            "messages": [
                {
                    "role": "system",
                    "content": "You are a helpful assistant. Find the mathematical formula in the image and convert it to LaTeX. If no formula is found, reply with: 'No formula found'. Only reply with the content enclosed in \\[ and \\]."
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_data
                            }
                        }
                    ]
                }
            ]
        }

        req = urllib.request.Request(
            OPENROUTER_URL,
            data=json.dumps(payload).encode('utf-8'),
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://github.com/kiwiii2409",
                "X-Title": "img2tex"
            }
        )

        response = urllib.request.urlopen(req)
        response_data = json.loads(response.read().decode('utf-8'))

        if 'choices' in response_data and len(response_data['choices']) > 0:
            ai_text = response_data['choices'][0]['message']['content']
        else:
            ai_text = "Error: AI returned no content."
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'result': ai_text})
        }
    except urllib.error.HTTPError as e:
        if e.code == 429:
            user_msg = "Error: OpenRouter rate limit exceeded."
            return {
                'statusCode': e.code, 
                'headers': headers,
                'body': json.dumps({'result': user_msg})
            }        
        else:
            return {
                'statusCode': e.code,
                'headers': headers,
                'body': json.dumps({'result': e.reason})
            }
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'result': e.reason})
        }
