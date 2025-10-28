const mapNumber = (number, in_min, in_max, out_min, out_max) => {
  return (number - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
};

class Star {
	constructor(options) {
		let {size, x, y, color, activated, pitch, velocity, pan, volume} = options;
		this.width = size;
		this.height = size;
		this.x = x;
		this.y = y;
		this.color = color;
		this.pan = pan;
		this.opacity = 0.5;
		
		this.pitch = Tone.Midi(pitch).toFrequency();
		this.velocity = velocity;
		
		this.panner = new Tone.Panner(this.pan).toMaster();
		
		this.synth = new Tone.Synth({
			oscillator: {
				type: 'sine'
			}
		}).chain(this.panner);
		
		this.synth.volume.value = volume;
		this.activated = activated;
	}
}

class SystemScale {
	constructor(octaves) {
		this.intervals = [0,2,4,6,7,9,11,12];
		this.notes = [];
		for(let i=1; i<=octaves; i++) {
			for(let j=0; j<this.intervals.length; j++) {
				let number = this.intervals[j];
				this.notes.push((12*i)+48+(number));
			}
		}
	}
}

class Satellite {
	constructor(options) {
		let {centerX, centerY, radius, speed, size} = options;
		this.centerX = centerX;
		this.centerY = centerY;
		this.radius = radius;
		this.speed = speed;
		this.size = size;
		this.angle = 0;
		this.x = centerX + radius;
		this.y = centerY;
		this.color = '#FFDB4D';
		this.trail = [];
		this.trailLength = 20;
		this.noiseOffsetX = Math.random() * 1000;
		this.noiseOffsetY = Math.random() * 1000;
		this.noiseSpeed = 0.01;
	}

	update() {
		this.angle += this.speed;
		let baseX = this.centerX + Math.cos(this.angle) * this.radius;
		let baseY = this.centerY + Math.sin(this.angle) * this.radius;

		// Хаотичное движение с шумом
		let noiseX = (Math.sin(this.noiseOffsetX) + Math.cos(this.noiseOffsetX * 0.7)) * 30;
		let noiseY = (Math.sin(this.noiseOffsetY) + Math.cos(this.noiseOffsetY * 0.7)) * 30;

		this.x = baseX + noiseX;
		this.y = baseY + noiseY;

		this.noiseOffsetX += this.noiseSpeed;
		this.noiseOffsetY += this.noiseSpeed;

		// Обновление следа
		this.trail.push({x: this.x, y: this.y});
		if (this.trail.length > this.trailLength) {
			this.trail.shift();
		}
	}

	draw(ctx) {
		// Отрисовка следа
		for (let i = 0; i < this.trail.length; i++) {
			let alpha = i / this.trailLength * 0.5;
			ctx.fillStyle = `rgba(255, 219, 77, ${alpha})`;
			ctx.beginPath();
			ctx.arc(this.trail[i].x, this.trail[i].y, this.size * 0.3, 0, 2 * Math.PI);
			ctx.fill();
		}

		// Отрисовка корпуса спутника (прямоугольник с деталями)
		ctx.fillStyle = '#C0C0C0';
		ctx.fillRect(this.x - this.size, this.y - this.size * 0.5, this.size * 2, this.size);

		// Солнечные панели
		ctx.fillStyle = '#000080';
		ctx.fillRect(this.x - this.size * 1.5, this.y - this.size * 0.3, this.size * 0.5, this.size * 0.6);
		ctx.fillRect(this.x + this.size, this.y - this.size * 0.3, this.size * 0.5, this.size * 0.6);

		// Антенны
		ctx.strokeStyle = '#FFFFFF';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(this.x, this.y - this.size * 0.5);
		ctx.lineTo(this.x, this.y - this.size * 1.2);
		ctx.moveTo(this.x + this.size, this.y);
		ctx.lineTo(this.x + this.size * 1.5, this.y);
		ctx.stroke();

		// Светящаяся точка (двигатель)
		ctx.fillStyle = '#FF4500';
		ctx.beginPath();
		ctx.arc(this.x - this.size, this.y, this.size * 0.3, 0, 2 * Math.PI);
		ctx.fill();
	}
}

class StarSystem {
	constructor(options) {
		let {height, width, maxSize, minSize, starCount, speed, speedIncrement} = options;
		this.height = height;
		this.width = width;
		this.maxSize = maxSize;
		this.minSize = minSize;
		this.starCount = starCount;
		this.speed = speed;
		this.speedIncrement = speedIncrement;

		this.canvas = null;
		this.ctx = null;

		this.stars = [];
		this.scale = new SystemScale(2);
		this.isSpacePressed = false;

		this.instruments = ['sine', 'square', 'sawtooth', 'triangle'];
		this.currentInstrumentIndex = 0;

		this.backgrounds = ['#000000', '#000080', '#800000', '#008000', '#800080', '#808000', '#008080', '#404040'];
		this.currentBackgroundIndex = 0;

		this.flashes = [];

		this.satellite = new Satellite({
			centerX: this.width / 2,
			centerY: this.height / 2,
			radius: 100,
			speed: 0.02,
			size: 24
		});
		
		this.filter = new Tone.Filter({
			type: 'lowpass',
			frequency: 1200,
			rolloff: -24,
			Q: 1,
			gain: 0
		}).toMaster();
		
		this.panLeft = new Tone.Panner(-1);
		this.panRight = new Tone.Panner(1);

		let droneOptions = {
			oscillator: {
				type: 'sine2'
			},
			envelope: {
				attack: 2,
				decay: 0,
				sustain: 1,
				release: 2
			}
		};
		
		this.droneLeft = new Tone.Synth(droneOptions).chain(this.panLeft, this.filter);
		this.droneRight = new Tone.Synth(droneOptions).chain(this.panRight, this.filter);
		this.drone = new Tone.Synth(droneOptions).chain(this.filter);
		this.droneTop = new Tone.Synth(droneOptions).chain(this.filter);
		this.drone.volume.value = this.droneLeft.volume.value = this.droneRight.volume.value = -20;
		this.droneTop.volume.value = -20;
		
		this.delay = new Tone.PingPongDelay("4n", 0.6).toMaster();
		this.delay.wet.value = 0.3;

		// Эффекты для спутника
		this.satelliteFilter = new Tone.Filter({
			type: 'lowpass',
			frequency: 800,
			rolloff: -24
		}).toMaster();

		this.satelliteReverb = new Tone.Reverb({
			decay: 2,
			wet: 0.3
		}).toMaster();

		this.satelliteSynth = new Tone.Synth({
			oscillator: {
				type: 'sawtooth'
			},
			envelope: {
				attack: 0.1,
				decay: 0.2,
				sustain: 0.5,
				release: 0.8
			}
		}).chain(this.satelliteFilter, this.satelliteReverb);

		this.createCanvas();
		this.createInitialStars();
	}
	
	createCanvas() {
		this.canvas = document.createElement('canvas');
		this.ctx = this.canvas.getContext('2d');
		this.canvas.width = this.width;
		this.canvas.height = this.height;

		this.ctx.fillStyle = 'black';
		this.ctx.fillRect(0,0,this.width,this.height);

		document.body.append(this.canvas);

		this.canvas.addEventListener('click', (e) => {
			const rect = this.canvas.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;
			if (x > this.width / 2) {
				this.addStarAtPosition(x, y);
			}
		});

		this.canvas.addEventListener('mousemove', (e) => {
			if (this.isSpacePressed) {
				const rect = this.canvas.getBoundingClientRect();
				const x = e.clientX - rect.left;
				const y = e.clientY - rect.top;
				this.addStarAtPosition(x, y);
			}
		});

		this.drawMidPoint();
	}
	
	drawMidPoint() {
		this.ctx.fillStyle = 'rgba(255,255,0,0.6)';
		this.ctx.fillRect(this.width/2, 0, this.minSize, this.height);
	}
	
	createInitialStars() {
		for(let i=0; i<this.starCount; i++) {
			let randomX = Math.floor(Math.random()*this.width);
			let randomY = Math.floor(Math.random()*this.height);
			let randomSize = Math.random() * (this.maxSize - this.minSize) + this.minSize;
			let randomPan = Math.random() * (1 - -1) + -1;
			let color = 'rgba(255,255,255,0.5)';
			let activated = false;
			
			let pitchIndex = mapNumber(randomY, 0, this.height, this.scale.notes.length, 0);
			let pitch = this.scale.notes[Math.floor(pitchIndex)];
			let velocity = mapNumber(randomSize, this.minSize, this.maxSize, 0, 1);
			
			let computedVolume = mapNumber(randomSize, this.minSize, this.maxSize, -24, -12);
			
			if(randomX <= this.width/2) {
				color = 'yellow';
				activated = true;
			}
			
			let star = new Star({
				size: randomSize,
				x: randomX,
				y: randomY,
				color: color,
				activated: activated,
				pitch: pitch,
				velocity: velocity,
				pan: randomPan,
				volume: computedVolume
			});
			
			this.stars.push(star);
		}
		
		this.drawStars();
	}
	
	drawStars() {
		for(let star of this.stars) {
			this.ctx.fillStyle = star.color;
			this.ctx.fillRect(star.x, star.y, star.width, star.height);
		}
	}
	
	replaceRemovedStar() {
		let randomY = Math.floor(Math.random()*this.height);
		let randomSize = Math.random() * (this.maxSize - this.minSize) + this.minSize;
		let randomPan = Math.random() * (1 - -1) + -1;
		
		let pitchIndex = mapNumber(randomY, 0, this.height, this.scale.notes.length, 0);
		let pitch = this.scale.notes[Math.floor(pitchIndex)];
		let velocity = mapNumber(randomSize, this.minSize, this.maxSize, 0, 1);
		
		let computedVolume = mapNumber(randomSize, this.minSize, this.maxSize, -24, -12);

		let star = new Star({
			size: randomSize,
			x: this.width+randomSize,
			y: randomY,
			color: 'rgba(255,255,255,0.5)',
			pitch: pitch,
			velocity: velocity,
			pan: randomPan,
			volume: computedVolume
		});

		this.stars.push(star);
	}
	
	changeSpeed(direction) {
		if(direction === "up") {
			this.speed += this.speedIncrement;
		} else {
			if(this.speed>0) {
				this.speed -= this.speedIncrement;
			}
		}
	}

	changeInstrument() {
		this.currentInstrumentIndex = (this.currentInstrumentIndex + 1) % this.instruments.length;
		this.currentInstrument = this.instruments[this.currentInstrumentIndex];
		document.getElementById('instrument').innerHTML = `Инструмент: ${this.currentInstrument.charAt(0).toUpperCase() + this.currentInstrument.slice(1)}`;
		// Обновление всех существующих звёзд
		for(let star of this.stars) {
			star.synth.oscillator.type = this.currentInstrument;
		}
	}

	changeBackground() {
		this.currentBackgroundIndex = (this.currentBackgroundIndex + 1) % this.backgrounds.length;
		this.currentBackground = this.backgrounds[this.currentBackgroundIndex];
		document.body.style.backgroundColor = this.currentBackground;
	}

	addStarAtPosition(x, y) {
		let randomSize = Math.random() * (this.maxSize - this.minSize) + this.minSize;
		let randomPan = Math.random() * (1 - -1) + -1;

		let padding = this.height * 0.05;
		let effectiveHeight = this.height - 2 * padding;
		let pitchIndex = mapNumber(y, padding, this.height - padding, this.scale.notes.length - 8, 4);
		let pitch = this.scale.notes[Math.floor(pitchIndex)];
		let velocity = mapNumber(randomSize, this.minSize, this.maxSize, 0, 1);

		let computedVolume = mapNumber(randomSize, this.minSize, this.maxSize, -24, -12);

		let star = new Star({
			size: randomSize,
			x: x,
			y: y,
			color: 'rgba(255,255,255,0.5)',
			pitch: pitch,
			velocity: velocity,
			pan: randomPan,
			volume: computedVolume
		});

		this.stars.push(star);
		this.drawStars();
	}


	
	animate = () => {
		this.ctx.fillStyle = "black";
		this.ctx.fillRect(0,0,this.width,this.height);

		this.drawMidPoint();

		// Обновление и отрисовка спутника
		this.satellite.update();
		this.satellite.draw(this.ctx);

		// Обновление и отрисовка вспышек
		for (let i = this.flashes.length - 1; i >= 0; i--) {
			let flash = this.flashes[i];
			flash.opacity -= 0.05;
			if (flash.opacity <= 0) {
				this.flashes.splice(i, 1);
			} else {
				this.ctx.fillStyle = `rgba(255, 255, 255, ${flash.opacity})`;
				this.ctx.beginPath();
				this.ctx.arc(flash.x, flash.y, flash.size, 0, 2 * Math.PI);
				this.ctx.fill();
			}
		}

		// Влияние спутника на ритм и громкость
		let rhythmFactor = Math.sin(this.satellite.angle * 2) * 0.5 + 0.5; // 0-1
		let volumeFactor = Math.cos(this.satellite.angle) * 0.3 + 0.7; // 0.4-1

		// Изменение скорости звёзд (ритм)
		let baseSpeed = 0.6;
		this.speed = baseSpeed + rhythmFactor * 0.4;

		// Изменение громкости дронов
		this.drone.volume.value = -20 + volumeFactor * 10;
		this.droneLeft.volume.value = -20 + volumeFactor * 10;
		this.droneRight.volume.value = -20 + volumeFactor * 10;
		this.droneTop.volume.value = -20 + volumeFactor * 10;

		// Периодические звуки спутника
		if (Math.floor(this.satellite.angle / (Math.PI * 2) * 8) !== Math.floor((this.satellite.angle - this.satellite.speed) / (Math.PI * 2) * 8)) {
			let note = Tone.Midi(60 + Math.floor(rhythmFactor * 12)).toFrequency();
			this.satelliteSynth.triggerAttackRelease(note, '16n', Tone.now(), volumeFactor * 0.5);
		}

		for(let i=0; i<this.stars.length; i++) {
			this.stars[i].x -= this.speed;
			let star = this.stars[i];

			if(star.x < 0) {
				this.stars.splice(i, 1);
				this.replaceRemovedStar();
			}

			if(star.x <= this.width/2) {
				if(star.opacity <= 1) {
					this.stars[i].opacity += 0.04;
					star.color = `rgba(255,255,0,${star.opacity})`;
				}
				if(!star.activated) {
					star.synth.connect(this.delay);
					star.synth.triggerAttackRelease(star.pitch, '8n');
					this.stars[i].activated = true;
					// Добавление вспышки при активации звезды
					this.flashes.push({
						x: star.x,
						y: star.y,
						size: star.size * 3,
						opacity: 1,
						color: '#FFFFFF'
					});
				}
			}

			this.ctx.fillStyle = star.color;
			this.ctx.fillRect(star.x, star.y, star.width, star.height);
		}

		this.animation = requestAnimationFrame(this.animate);
	}
	
	run() {
		this.droneLeft.triggerAttack('g2');
		this.droneRight.triggerAttack('c2');
		this.drone.triggerAttack('c3');
		this.droneTop.triggerAttack('e3');
		requestAnimationFrame(this.animate);
	}
}

let system = new StarSystem({
	height: window.innerHeight,
	width: window.innerWidth,
	minSize: 2,
	maxSize: 5,
	starCount: 50,
	speed: 0.6,
	speedIncrement: 0.2
});

system.currentInstrument = system.instruments[system.currentInstrumentIndex];
system.currentBackground = system.backgrounds[system.currentBackgroundIndex];

let playing = false;

let startButton = document.getElementById('start');
startButton.addEventListener('click', (e)=>{
	document.getElementById('container').classList.add('disabled');
	playing = true;
	system.run();
});

let pauseButton = document.getElementById('pause');
pauseButton.addEventListener('click', ()=>{
	playing = !playing;
	if(playing) {
		pauseButton.innerHTML = 'pause';
		playing = true;
		system.run();
	} else {
		pauseButton.innerHTML = 'play';
		cancelAnimationFrame(system.animation);
		system.droneLeft.triggerRelease();
		system.droneRight.triggerRelease();
		system.drone.triggerRelease();
		system.droneTop.triggerRelease();
	}
});

document.getElementById('speeddown').addEventListener('click', ()=>{
	system.changeSpeed('down');
});

document.getElementById('speedup').addEventListener('click', ()=>{
	system.changeSpeed('up');
});

document.getElementById('instrument').addEventListener('click', ()=>{
	system.changeInstrument();
});

document.getElementById('background').addEventListener('click', ()=>{
	system.changeBackground();
});

document.addEventListener('keydown', (e) => {
	if (e.code === 'Space') {
		e.preventDefault();
		system.isSpacePressed = true;
	}
});

document.addEventListener('keyup', (e) => {
	if (e.code === 'Space') {
		e.preventDefault();
		system.isSpacePressed = false;
	}
});

Tone.Master.volume.value = -8;