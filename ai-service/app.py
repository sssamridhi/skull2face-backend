import os, sys, uuid, base64
from flask import Flask, request, jsonify
from flask_cors import CORS

sys.path.insert(0, '/home/ffr/forensic_reconstruction')
os.environ["CUDA_VISIBLE_DEVICES"] = "4"

app = Flask(__name__)
CORS(app)

OUTPUT_DIR = '/home/ffr/forensic_reconstruction/outputs/web_results'
UPLOAD_DIR = '/home/ffr/forensic_reconstruction/outputs/web_uploads'
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

print("=" * 55)
print("  Loading generate_face — please wait...")
print("=" * 55)

from diffusion.scripts.step4_skull_to_face import generate_face
print("  ✅ generate_face ready!")
print("=" * 55)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status':'ok','model_loaded':True})

@app.route('/reconstruct', methods=['POST'])
def reconstruct():
    try:
        data      = request.json
        record_id = data.get('record_id', str(uuid.uuid4()))
        sf_b64    = data.get('sf_image')
        ss_b64    = data.get('ss_image')

        if not sf_b64:
            return jsonify({'success':False,'error':'No frontal image'}), 400

        sf_path = os.path.join(UPLOAD_DIR, f'{record_id}_sf.png')
        ss_path = os.path.join(UPLOAD_DIR, f'{record_id}_ss.png')

        with open(sf_path, 'wb') as f:
            f.write(base64.b64decode(sf_b64))

        if ss_b64:
            with open(ss_path, 'wb') as f:
                f.write(base64.b64decode(ss_b64))
        else:
            ss_path = sf_path

        profile = {
            'gender':    data.get('gender',    'Auto Detect'),
            'age_group': data.get('age',        'Auto'),
            'hair':      data.get('hair_color', 'Auto'),
            'skin_tone': data.get('skin_tone',  'Auto')
        }

        print(f"\n📥 Record: {record_id} | Profile: {profile}")

        case_out = os.path.join(OUTPUT_DIR, record_id)
        os.makedirs(case_out, exist_ok=True)

        result_path = generate_face(
            sf_path    = sf_path,
            ss_path    = ss_path,
            output_dir = case_out,
            skull_id   = record_id,
            profile    = profile
        )

        if not result_path or not os.path.exists(result_path):
            raise Exception('No output file returned')

        print(f"✅ Done: {result_path}")

        with open(result_path, 'rb') as f:
            face_b64 = base64.b64encode(f.read()).decode('utf-8')

        try:
            os.remove(sf_path)
            if ss_b64: os.remove(ss_path)
        except: pass

        return jsonify({'success':True,'face_b64':face_b64,'record_id':record_id})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success':False,'error':str(e)}), 500

if __name__ == '__main__':
    print(f"\n🚀 Flask API → http://0.0.0.0:8000\n")
    app.run(host='0.0.0.0', port=8000, debug=False, threaded=False)