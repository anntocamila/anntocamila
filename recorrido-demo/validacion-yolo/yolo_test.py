import sys,glob
from ultralytics import YOLO
m=YOLO('yolo11n.pt')
for f in sorted(glob.glob(sys.argv[1]+'/clean_*.png')):
    r=m.predict(f,classes=[0],conf=0.25,imgsz=1280,verbose=False)[0]
    print(f.split('/')[-1], 'personas:',len(r.boxes), 'conf media: %.2f'%(r.boxes.conf.mean().item() if len(r.boxes) else 0))
    r.save(filename=f.replace('clean_','yolo_'))
