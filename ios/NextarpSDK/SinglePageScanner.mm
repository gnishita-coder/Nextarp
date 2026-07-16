//
// SinglePageScanner.mm
// Live camera with ALWAYS-VISIBLE crop frame + Vision edge snap → one photo.
//

#import "SinglePageScanner.h"
#import <React/RCTUtils.h>
#import <AVFoundation/AVFoundation.h>
#import <Vision/Vision.h>
#import <CoreImage/CoreImage.h>

#pragma mark - Live camera

@interface LiveDocumentCameraViewController : UIViewController <AVCaptureVideoDataOutputSampleBufferDelegate, AVCapturePhotoCaptureDelegate>
@property (nonatomic, copy) void (^onFinished)(UIImage *_Nullable image, BOOL cancelled);
@end

@implementation LiveDocumentCameraViewController {
  AVCaptureSession *_session;
  AVCaptureDeviceInput *_deviceInput;
  AVCapturePhotoOutput *_photoOutput;
  AVCaptureVideoDataOutput *_videoOutput;
  AVCaptureVideoPreviewLayer *_previewLayer;

  // Always-visible crop UI (does not wait for Vision).
  UIView *_overlayContainer;
  CAShapeLayer *_dimLayer;
  CAShapeLayer *_frameLayer;
  CAShapeLayer *_cornerLayer;
  CAShapeLayer *_detectedLayer;
  CAShapeLayer *_detectedFill;
  UILabel *_titleLabel;
  UILabel *_hintLabel;
  UIButton *_shutterButton;
  UIButton *_cancelButton;

  dispatch_queue_t _sessionQueue;
  dispatch_queue_t _visionQueue;
  BOOL _isCapturing;
  BOOL _sessionRunning;
  NSInteger _frameSkip;
  VNRectangleObservation *_latestObservation;
  CGSize _latestBufferSize;
  CGRect _guideRect;
}

- (void)viewDidLoad
{
  [super viewDidLoad];
  self.view.backgroundColor = [UIColor blackColor];
  self.modalPresentationStyle = UIModalPresentationFullScreen;

  _sessionQueue = dispatch_queue_create("com.nextarpsdk.scansession", DISPATCH_QUEUE_SERIAL);
  _visionQueue = dispatch_queue_create("com.nextarpsdk.livevision", DISPATCH_QUEUE_SERIAL);
  _latestBufferSize = CGSizeZero;
  _guideRect = CGRectZero;

  [self buildPreview];
  [self buildCropOverlay];
  [self buildControls];
  [self configureSession];
}

- (void)viewDidAppear:(BOOL)animated
{
  [super viewDidAppear:animated];
  [self startSession];
}

- (void)viewWillDisappear:(BOOL)animated
{
  [super viewWillDisappear:animated];
  [self stopSession];
}

- (void)viewDidLayoutSubviews
{
  [super viewDidLayoutSubviews];
  _previewLayer.frame = self.view.bounds;
  _overlayContainer.frame = self.view.bounds;
  [self layoutCropFrame];
}

#pragma mark - UI

- (void)buildPreview
{
  _previewLayer = [[AVCaptureVideoPreviewLayer alloc] init];
  _previewLayer.videoGravity = AVLayerVideoGravityResizeAspectFill;
  _previewLayer.frame = self.view.bounds;
  [self.view.layer addSublayer:_previewLayer];
}

- (void)buildCropOverlay
{
  _overlayContainer = [[UIView alloc] initWithFrame:self.view.bounds];
  _overlayContainer.userInteractionEnabled = NO;
  _overlayContainer.backgroundColor = [UIColor clearColor];
  [self.view addSubview:_overlayContainer];

  // Dark mask with a clear cut-out for the ID guide.
  _dimLayer = [CAShapeLayer layer];
  _dimLayer.fillRule = kCAFillRuleEvenOdd;
  _dimLayer.fillColor = [[UIColor colorWithWhite:0 alpha:0.55] CGColor];
  [_overlayContainer.layer addSublayer:_dimLayer];

  // Solid frame around the cut-out.
  _frameLayer = [CAShapeLayer layer];
  _frameLayer.fillColor = nil;
  _frameLayer.strokeColor = [[UIColor whiteColor] CGColor];
  _frameLayer.lineWidth = 2.0;
  [_overlayContainer.layer addSublayer:_frameLayer];

  // Thick corner brackets (classic document-scanner look).
  _cornerLayer = [CAShapeLayer layer];
  _cornerLayer.fillColor = nil;
  _cornerLayer.strokeColor = [[UIColor colorWithRed:0.42 green:0.31 blue:0.88 alpha:1] CGColor];
  _cornerLayer.lineWidth = 5.0;
  _cornerLayer.lineCap = kCALineCapRound;
  _cornerLayer.lineJoin = kCALineJoinRound;
  [_overlayContainer.layer addSublayer:_cornerLayer];

  // Live detected document quad (on top of the static guide).
  _detectedFill = [CAShapeLayer layer];
  _detectedFill.fillColor = [[UIColor colorWithRed:0.42 green:0.31 blue:0.88 alpha:0.22] CGColor];
  [_overlayContainer.layer addSublayer:_detectedFill];

  _detectedLayer = [CAShapeLayer layer];
  _detectedLayer.fillColor = nil;
  _detectedLayer.strokeColor = [[UIColor colorWithRed:0.55 green:0.95 blue:0.55 alpha:1] CGColor];
  _detectedLayer.lineWidth = 3.5;
  _detectedLayer.lineJoin = kCALineJoinRound;
  [_overlayContainer.layer addSublayer:_detectedLayer];

  _titleLabel = [[UILabel alloc] init];
  _titleLabel.text = @"Scan document";
  _titleLabel.textColor = [UIColor whiteColor];
  _titleLabel.font = [UIFont systemFontOfSize:18 weight:UIFontWeightBold];
  _titleLabel.textAlignment = NSTextAlignmentCenter;
  _titleLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [self.view addSubview:_titleLabel];

  _hintLabel = [[UILabel alloc] init];
  _hintLabel.text = @"Fit the ID inside the purple corners";
  _hintLabel.textColor = [[UIColor whiteColor] colorWithAlphaComponent:0.9];
  _hintLabel.font = [UIFont systemFontOfSize:14 weight:UIFontWeightSemibold];
  _hintLabel.textAlignment = NSTextAlignmentCenter;
  _hintLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [self.view addSubview:_hintLabel];

  [NSLayoutConstraint activateConstraints:@[
    [_titleLabel.centerXAnchor constraintEqualToAnchor:self.view.centerXAnchor],
    [_titleLabel.topAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.topAnchor constant:16],
    [_hintLabel.centerXAnchor constraintEqualToAnchor:self.view.centerXAnchor],
    [_hintLabel.topAnchor constraintEqualToAnchor:_titleLabel.bottomAnchor constant:6],
    [_hintLabel.leadingAnchor constraintGreaterThanOrEqualToAnchor:self.view.leadingAnchor constant:20],
    [_hintLabel.trailingAnchor constraintLessThanOrEqualToAnchor:self.view.trailingAnchor constant:-20],
  ]];
}

- (void)buildControls
{
  _cancelButton = [UIButton buttonWithType:UIButtonTypeSystem];
  [_cancelButton setTitle:@"Cancel" forState:UIControlStateNormal];
  [_cancelButton setTitleColor:[UIColor whiteColor] forState:UIControlStateNormal];
  _cancelButton.titleLabel.font = [UIFont systemFontOfSize:16 weight:UIFontWeightSemibold];
  _cancelButton.translatesAutoresizingMaskIntoConstraints = NO;
  [_cancelButton addTarget:self action:@selector(onCancel) forControlEvents:UIControlEventTouchUpInside];
  [self.view addSubview:_cancelButton];

  _shutterButton = [UIButton buttonWithType:UIButtonTypeCustom];
  _shutterButton.backgroundColor = [UIColor whiteColor];
  _shutterButton.layer.cornerRadius = 36;
  _shutterButton.layer.borderColor = [[UIColor colorWithWhite:1 alpha:0.65] CGColor];
  _shutterButton.layer.borderWidth = 5;
  _shutterButton.translatesAutoresizingMaskIntoConstraints = NO;
  [_shutterButton addTarget:self action:@selector(onShutter) forControlEvents:UIControlEventTouchUpInside];
  [self.view addSubview:_shutterButton];

  UIView *ring = [[UIView alloc] init];
  ring.userInteractionEnabled = NO;
  ring.layer.borderColor = [[UIColor whiteColor] CGColor];
  ring.layer.borderWidth = 3;
  ring.layer.cornerRadius = 44;
  ring.translatesAutoresizingMaskIntoConstraints = NO;
  [self.view insertSubview:ring belowSubview:_shutterButton];

  [NSLayoutConstraint activateConstraints:@[
    [_cancelButton.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor constant:24],
    [_cancelButton.centerYAnchor constraintEqualToAnchor:_shutterButton.centerYAnchor],

    [_shutterButton.centerXAnchor constraintEqualToAnchor:self.view.centerXAnchor],
    [_shutterButton.bottomAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.bottomAnchor constant:-24],
    [_shutterButton.widthAnchor constraintEqualToConstant:72],
    [_shutterButton.heightAnchor constraintEqualToConstant:72],

    [ring.centerXAnchor constraintEqualToAnchor:_shutterButton.centerXAnchor],
    [ring.centerYAnchor constraintEqualToAnchor:_shutterButton.centerYAnchor],
    [ring.widthAnchor constraintEqualToConstant:88],
    [ring.heightAnchor constraintEqualToConstant:88],
  ]];
}

- (void)layoutCropFrame
{
  CGRect bounds = self.view.bounds;
  if (bounds.size.width < 1 || bounds.size.height < 1) {
    return;
  }

  // ID-1 aspect guide, always visible.
  CGFloat width = bounds.size.width * 0.88;
  CGFloat height = width / 1.586;
  if (height > bounds.size.height * 0.46) {
    height = bounds.size.height * 0.46;
    width = height * 1.586;
  }
  _guideRect = CGRectMake((bounds.size.width - width) * 0.5,
                          (bounds.size.height - height) * 0.38,
                          width,
                          height);

  UIBezierPath *dimPath = [UIBezierPath bezierPathWithRect:bounds];
  [dimPath appendPath:[UIBezierPath bezierPathWithRoundedRect:_guideRect cornerRadius:8]];
  _dimLayer.path = dimPath.CGPath;
  _dimLayer.frame = bounds;

  UIBezierPath *framePath = [UIBezierPath bezierPathWithRoundedRect:_guideRect cornerRadius:8];
  _frameLayer.path = framePath.CGPath;
  _frameLayer.frame = bounds;

  _cornerLayer.path = [self cornerBracketsPathInRect:_guideRect length:28].CGPath;
  _cornerLayer.frame = bounds;
}

- (UIBezierPath *)cornerBracketsPathInRect:(CGRect)rect length:(CGFloat)length
{
  UIBezierPath *path = [UIBezierPath bezierPath];
  CGFloat minX = CGRectGetMinX(rect);
  CGFloat minY = CGRectGetMinY(rect);
  CGFloat maxX = CGRectGetMaxX(rect);
  CGFloat maxY = CGRectGetMaxY(rect);

  // Top-left
  [path moveToPoint:CGPointMake(minX, minY + length)];
  [path addLineToPoint:CGPointMake(minX, minY)];
  [path addLineToPoint:CGPointMake(minX + length, minY)];
  // Top-right
  [path moveToPoint:CGPointMake(maxX - length, minY)];
  [path addLineToPoint:CGPointMake(maxX, minY)];
  [path addLineToPoint:CGPointMake(maxX, minY + length)];
  // Bottom-right
  [path moveToPoint:CGPointMake(maxX, maxY - length)];
  [path addLineToPoint:CGPointMake(maxX, maxY)];
  [path addLineToPoint:CGPointMake(maxX - length, maxY)];
  // Bottom-left
  [path moveToPoint:CGPointMake(minX + length, maxY)];
  [path addLineToPoint:CGPointMake(minX, maxY)];
  [path addLineToPoint:CGPointMake(minX, maxY - length)];
  return path;
}

#pragma mark - Session

- (void)configureSession
{
  _session = [[AVCaptureSession alloc] init];

  dispatch_async(_sessionQueue, ^{
    [self->_session beginConfiguration];
    if ([self->_session canSetSessionPreset:AVCaptureSessionPresetHigh]) {
      self->_session.sessionPreset = AVCaptureSessionPresetHigh;
    }

    AVCaptureDevice *device =
      [AVCaptureDevice defaultDeviceWithDeviceType:AVCaptureDeviceTypeBuiltInWideAngleCamera
                                         mediaType:AVMediaTypeVideo
                                          position:AVCaptureDevicePositionBack];
    if (!device) {
      device = [AVCaptureDevice defaultDeviceWithMediaType:AVMediaTypeVideo];
    }
    if (!device) {
      [self->_session commitConfiguration];
      return;
    }

    NSError *error = nil;
    AVCaptureDeviceInput *input = [AVCaptureDeviceInput deviceInputWithDevice:device error:&error];
    if (input && !error && [self->_session canAddInput:input]) {
      [self->_session addInput:input];
      self->_deviceInput = input;
    }

    self->_photoOutput = [[AVCapturePhotoOutput alloc] init];
    if ([self->_session canAddOutput:self->_photoOutput]) {
      [self->_session addOutput:self->_photoOutput];
    }

    self->_videoOutput = [[AVCaptureVideoDataOutput alloc] init];
    self->_videoOutput.alwaysDiscardsLateVideoFrames = YES;
    self->_videoOutput.videoSettings =
      @{ (id)kCVPixelBufferPixelFormatTypeKey: @(kCVPixelFormatType_32BGRA) };
    [self->_videoOutput setSampleBufferDelegate:self queue:self->_visionQueue];
    if ([self->_session canAddOutput:self->_videoOutput]) {
      [self->_session addOutput:self->_videoOutput];
    }

    AVCaptureConnection *videoConn = [self->_videoOutput connectionWithMediaType:AVMediaTypeVideo];
    if (videoConn.isVideoOrientationSupported) {
      videoConn.videoOrientation = AVCaptureVideoOrientationPortrait;
    }
    AVCaptureConnection *photoConn = [self->_photoOutput connectionWithMediaType:AVMediaTypeVideo];
    if (photoConn.isVideoOrientationSupported) {
      photoConn.videoOrientation = AVCaptureVideoOrientationPortrait;
    }

    [self->_session commitConfiguration];

    dispatch_async(dispatch_get_main_queue(), ^{
      self->_previewLayer.session = self->_session;
      if (self->_previewLayer.connection.isVideoOrientationSupported) {
        self->_previewLayer.connection.videoOrientation = AVCaptureVideoOrientationPortrait;
      }
    });
  });
}

- (void)startSession
{
  dispatch_async(_sessionQueue, ^{
    if (self->_sessionRunning || !self->_session) {
      return;
    }
    [self->_session startRunning];
    self->_sessionRunning = YES;
  });
}

- (void)stopSession
{
  dispatch_async(_sessionQueue, ^{
    if (!self->_sessionRunning || !self->_session) {
      return;
    }
    [self->_session stopRunning];
    self->_sessionRunning = NO;
  });
}

#pragma mark - Actions

- (void)onCancel
{
  if (_isCapturing) {
    return;
  }
  [self stopSession];
  void (^finished)(UIImage *, BOOL) = self.onFinished;
  self.onFinished = nil;
  [self dismissViewControllerAnimated:YES completion:^{
    if (finished) {
      finished(nil, YES);
    }
  }];
}

- (void)onShutter
{
  if (_isCapturing || !_photoOutput) {
    return;
  }
  _isCapturing = YES;
  _shutterButton.enabled = NO;

  AVCapturePhotoSettings *settings = [AVCapturePhotoSettings photoSettings];
  if (_photoOutput.supportedFlashModes.count > 0) {
    settings.flashMode = AVCaptureFlashModeOff;
  }
  [_photoOutput capturePhotoWithSettings:settings delegate:self];
}

#pragma mark - Vision live detection

- (void)captureOutput:(AVCaptureOutput *)output
didOutputSampleBuffer:(CMSampleBufferRef)sampleBuffer
       fromConnection:(AVCaptureConnection *)connection
{
  if (_isCapturing) {
    return;
  }
  _frameSkip += 1;
  if (_frameSkip % 2 != 0) {
    return;
  }

  CVPixelBufferRef pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer);
  if (!pixelBuffer) {
    return;
  }

  CGSize bufferSize = CGSizeMake(CVPixelBufferGetWidth(pixelBuffer), CVPixelBufferGetHeight(pixelBuffer));
  // Portrait UI + portrait connection → buffer should already be upright.
  CGImagePropertyOrientation orientation = kCGImagePropertyOrientationUp;
  if (bufferSize.width > bufferSize.height) {
    // Buffer still landscape — tell Vision the device is portrait.
    orientation = kCGImagePropertyOrientationRight;
  }

  VNImageRequestHandler *handler =
    [[VNImageRequestHandler alloc] initWithCVPixelBuffer:pixelBuffer
                                             orientation:orientation
                                                 options:@{}];

  NSMutableArray<VNRectangleObservation *> *candidates = [NSMutableArray array];

  if (@available(iOS 15.0, *)) {
    VNDetectDocumentSegmentationRequest *docRequest = [[VNDetectDocumentSegmentationRequest alloc] init];
    if ([handler performRequests:@[docRequest] error:nil]) {
      for (id result in docRequest.results) {
        if ([result isKindOfClass:[VNRectangleObservation class]]) {
          [candidates addObject:result];
        }
      }
    }
  }

  if (candidates.count == 0) {
    VNDetectRectanglesRequest *rectRequest = [[VNDetectRectanglesRequest alloc] init];
    rectRequest.maximumObservations = 8;
    rectRequest.minimumConfidence = 0.2;
    rectRequest.minimumAspectRatio = 0.3;
    rectRequest.maximumAspectRatio = 1.0;
    rectRequest.minimumSize = 0.1;
    rectRequest.quadratureTolerance = 35.0;
    VNImageRequestHandler *rectHandler =
      [[VNImageRequestHandler alloc] initWithCVPixelBuffer:pixelBuffer
                                               orientation:orientation
                                                   options:@{}];
    if ([rectHandler performRequests:@[rectRequest] error:nil]) {
      for (id result in rectRequest.results) {
        if ([result isKindOfClass:[VNRectangleObservation class]]) {
          [candidates addObject:result];
        }
      }
    }
  }

  VNRectangleObservation *best = [self bestObservationIn:candidates];
  _latestObservation = best;
  // When Vision used .right orientation, normalized coords are in upright space
  // with width/height swapped relative to the raw buffer.
  CGSize mappingSize = bufferSize;
  if (orientation == kCGImagePropertyOrientationRight) {
    mappingSize = CGSizeMake(bufferSize.height, bufferSize.width);
  }
  _latestBufferSize = mappingSize;

  dispatch_async(dispatch_get_main_queue(), ^{
    [self renderDetectedOverlay:best bufferSize:mappingSize];
  });
}

- (BOOL)isPlausibleDocumentObservation:(VNRectangleObservation *)obs
{
  CGFloat area = obs.boundingBox.size.width * obs.boundingBox.size.height;
  return area >= 0.05 && area <= 0.96;
}

- (CGFloat)aspectScoreForObservation:(VNRectangleObservation *)obs
{
  CGFloat w = hypot(obs.topRight.x - obs.topLeft.x, obs.topRight.y - obs.topLeft.y);
  CGFloat h = hypot(obs.bottomLeft.x - obs.topLeft.x, obs.bottomLeft.y - obs.topLeft.y);
  if (w < 0.01 || h < 0.01) {
    return 0;
  }
  CGFloat ratio = MAX(w, h) / MIN(w, h);
  CGFloat diff = fabs(ratio - 1.586);
  CGFloat area = obs.boundingBox.size.width * obs.boundingBox.size.height;
  return area * MAX(obs.confidence, 0.1f) * (1.0 / (1.0 + diff * 2.0));
}

- (VNRectangleObservation *)bestObservationIn:(NSArray<VNRectangleObservation *> *)candidates
{
  VNRectangleObservation *best = nil;
  CGFloat bestScore = 0;
  for (VNRectangleObservation *obs in candidates) {
    if (![self isPlausibleDocumentObservation:obs]) {
      continue;
    }
    CGFloat score = [self aspectScoreForObservation:obs];
    if (score > bestScore) {
      bestScore = score;
      best = obs;
    }
  }
  return best;
}

- (CGPoint)viewPointFromVisionNormalized:(CGPoint)normalized bufferSize:(CGSize)bufferSize
{
  CGRect layerRect = _previewLayer.bounds;
  if (layerRect.size.width < 1 || layerRect.size.height < 1 || bufferSize.width < 1 || bufferSize.height < 1) {
    return CGPointZero;
  }

  CGFloat imageX = normalized.x * bufferSize.width;
  CGFloat imageY = (1.0 - normalized.y) * bufferSize.height;

  CGFloat imageAspect = bufferSize.width / bufferSize.height;
  CGFloat viewAspect = layerRect.size.width / layerRect.size.height;
  CGFloat scale;
  CGFloat xOffset = 0;
  CGFloat yOffset = 0;

  if (imageAspect > viewAspect) {
    scale = layerRect.size.height / bufferSize.height;
    xOffset = (layerRect.size.width - bufferSize.width * scale) * 0.5;
  } else {
    scale = layerRect.size.width / bufferSize.width;
    yOffset = (layerRect.size.height - bufferSize.height * scale) * 0.5;
  }

  return CGPointMake(imageX * scale + xOffset, imageY * scale + yOffset);
}

- (void)renderDetectedOverlay:(VNRectangleObservation *)observation bufferSize:(CGSize)bufferSize
{
  if (!observation) {
    _detectedLayer.path = nil;
    _detectedFill.path = nil;
    _hintLabel.text = @"Fit the ID inside the purple corners";
    _cornerLayer.strokeColor = [[UIColor colorWithRed:0.42 green:0.31 blue:0.88 alpha:1] CGColor];
    return;
  }

  CGPoint tl = [self viewPointFromVisionNormalized:observation.topLeft bufferSize:bufferSize];
  CGPoint tr = [self viewPointFromVisionNormalized:observation.topRight bufferSize:bufferSize];
  CGPoint br = [self viewPointFromVisionNormalized:observation.bottomRight bufferSize:bufferSize];
  CGPoint bl = [self viewPointFromVisionNormalized:observation.bottomLeft bufferSize:bufferSize];

  UIBezierPath *path = [UIBezierPath bezierPath];
  [path moveToPoint:tl];
  [path addLineToPoint:tr];
  [path addLineToPoint:br];
  [path addLineToPoint:bl];
  [path closePath];

  [CATransaction begin];
  [CATransaction setDisableActions:YES];
  _detectedLayer.path = path.CGPath;
  _detectedFill.path = path.CGPath;
  [CATransaction commit];

  _cornerLayer.strokeColor = [[UIColor colorWithRed:0.35 green:0.9 blue:0.45 alpha:1] CGColor];
  _hintLabel.text = @"Document detected — tap shutter";
}

#pragma mark - Photo

- (void)captureOutput:(AVCapturePhotoOutput *)output
didFinishProcessingPhoto:(AVCapturePhoto *)photo
                error:(NSError *)error
{
  if (error || !photo.fileDataRepresentation) {
    _isCapturing = NO;
    dispatch_async(dispatch_get_main_queue(), ^{
      self->_shutterButton.enabled = YES;
    });
    return;
  }

  UIImage *raw = [UIImage imageWithData:photo.fileDataRepresentation];
  VNRectangleObservation *locked = _latestObservation;
  UIImage *cropped = [LiveDocumentCameraViewController cropImage:raw preferringObservation:locked];

  dispatch_async(dispatch_get_main_queue(), ^{
    [self stopSession];
    void (^finished)(UIImage *, BOOL) = self.onFinished;
    self.onFinished = nil;
    [self dismissViewControllerAnimated:YES completion:^{
      if (finished) {
        finished(cropped ?: raw, NO);
      }
    }];
  });
}

#pragma mark - Crop helpers

+ (UIImage *)normalizedImage:(UIImage *)image
{
  if (!image || image.imageOrientation == UIImageOrientationUp) {
    return image;
  }
  UIGraphicsBeginImageContextWithOptions(image.size, NO, image.scale);
  [image drawInRect:CGRectMake(0, 0, image.size.width, image.size.height)];
  UIImage *normalized = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();
  return normalized ?: image;
}

+ (BOOL)isPlausible:(VNRectangleObservation *)obs
{
  CGFloat area = obs.boundingBox.size.width * obs.boundingBox.size.height;
  return area >= 0.05 && area <= 0.95;
}

+ (CGFloat)score:(VNRectangleObservation *)obs
{
  CGFloat w = hypot(obs.topRight.x - obs.topLeft.x, obs.topRight.y - obs.topLeft.y);
  CGFloat h = hypot(obs.bottomLeft.x - obs.topLeft.x, obs.bottomLeft.y - obs.topLeft.y);
  if (w < 0.01 || h < 0.01) {
    return 0;
  }
  CGFloat ratio = MAX(w, h) / MIN(w, h);
  CGFloat diff = fabs(ratio - 1.586);
  CGFloat area = obs.boundingBox.size.width * obs.boundingBox.size.height;
  return area * MAX(obs.confidence, 0.1f) * (1.0 / (1.0 + diff * 2.0));
}

+ (VNRectangleObservation *)bestIn:(NSArray<VNRectangleObservation *> *)candidates
{
  VNRectangleObservation *best = nil;
  CGFloat bestScore = 0;
  for (VNRectangleObservation *obs in candidates) {
    if (![self isPlausible:obs]) {
      continue;
    }
    CGFloat score = [self score:obs];
    if (score > bestScore) {
      bestScore = score;
      best = obs;
    }
  }
  return best;
}

+ (CIImage *)correctPerspective:(CIImage *)ciImage observation:(VNRectangleObservation *)observation
{
  CGSize size = ciImage.extent.size;
  CGPoint topLeft = CGPointMake(observation.topLeft.x * size.width, observation.topLeft.y * size.height);
  CGPoint topRight = CGPointMake(observation.topRight.x * size.width, observation.topRight.y * size.height);
  CGPoint bottomLeft = CGPointMake(observation.bottomLeft.x * size.width, observation.bottomLeft.y * size.height);
  CGPoint bottomRight = CGPointMake(observation.bottomRight.x * size.width, observation.bottomRight.y * size.height);

  return [ciImage imageByApplyingFilter:@"CIPerspectiveCorrection"
                    withInputParameters:@{
                      @"inputTopLeft": [CIVector vectorWithCGPoint:topLeft],
                      @"inputTopRight": [CIVector vectorWithCGPoint:topRight],
                      @"inputBottomLeft": [CIVector vectorWithCGPoint:bottomLeft],
                      @"inputBottomRight": [CIVector vectorWithCGPoint:bottomRight],
                    }];
}

+ (UIImage *)imageFromCorrected:(CIImage *)corrected scale:(CGFloat)scale
{
  if (!corrected) {
    return nil;
  }
  CIImage *croppedExtent = [corrected imageByCroppingToRect:CGRectIntegral(corrected.extent)];
  CIImage *translated = [croppedExtent imageByApplyingTransform:CGAffineTransformMakeTranslation(
                                                                  -croppedExtent.extent.origin.x,
                                                                  -croppedExtent.extent.origin.y)];
  CIContext *context = [CIContext contextWithOptions:@{ kCIContextUseSoftwareRenderer: @NO }];
  CGImageRef cgImage = [context createCGImage:translated fromRect:translated.extent];
  if (!cgImage) {
    return nil;
  }
  UIImage *image = [UIImage imageWithCGImage:cgImage scale:scale orientation:UIImageOrientationUp];
  CGImageRelease(cgImage);
  return image;
}

+ (UIImage *)cropImage:(UIImage *)image preferringObservation:(VNRectangleObservation *)preferred
{
  UIImage *normalized = [self normalizedImage:image];
  if (!normalized.CGImage) {
    return image;
  }

  CIImage *ciImage = [[CIImage alloc] initWithCGImage:normalized.CGImage];
  NSMutableArray<VNRectangleObservation *> *candidates = [NSMutableArray array];
  VNImageRequestHandler *handler =
    [[VNImageRequestHandler alloc] initWithCGImage:normalized.CGImage
                                       orientation:kCGImagePropertyOrientationUp
                                           options:@{}];

  if (@available(iOS 15.0, *)) {
    VNDetectDocumentSegmentationRequest *docRequest = [[VNDetectDocumentSegmentationRequest alloc] init];
    if ([handler performRequests:@[docRequest] error:nil]) {
      for (id result in docRequest.results) {
        if ([result isKindOfClass:[VNRectangleObservation class]]) {
          [candidates addObject:result];
        }
      }
    }
  }

  VNDetectRectanglesRequest *rectRequest = [[VNDetectRectanglesRequest alloc] init];
  rectRequest.maximumObservations = 12;
  rectRequest.minimumConfidence = 0.25;
  rectRequest.minimumAspectRatio = 0.35;
  rectRequest.maximumAspectRatio = 1.0;
  rectRequest.minimumSize = 0.12;
  rectRequest.quadratureTolerance = 30.0;
  VNImageRequestHandler *rectHandler =
    [[VNImageRequestHandler alloc] initWithCGImage:normalized.CGImage
                                       orientation:kCGImagePropertyOrientationUp
                                           options:@{}];
  if ([rectHandler performRequests:@[rectRequest] error:nil]) {
    for (id result in rectRequest.results) {
      if ([result isKindOfClass:[VNRectangleObservation class]]) {
        [candidates addObject:result];
      }
    }
  }

  VNRectangleObservation *best = [self bestIn:candidates] ?: preferred;
  if (!best) {
    return normalized;
  }

  UIImage *cropped = [self imageFromCorrected:[self correctPerspective:ciImage observation:best]
                                        scale:normalized.scale];
  return cropped ?: normalized;
}

@end

#pragma mark - RN module

@interface SinglePageScanner ()
@property (nonatomic, copy) RCTPromiseResolveBlock resolve;
@property (nonatomic, copy) RCTPromiseRejectBlock reject;
@end

@implementation SinglePageScanner

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_EXPORT_METHOD(launch:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (self.resolve != nil) {
      reject(@"IN_PROGRESS", @"A scan is already in progress", nil);
      return;
    }

    AVAuthorizationStatus status = [AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeVideo];
    if (status == AVAuthorizationStatusDenied || status == AVAuthorizationStatusRestricted) {
      reject(@"NO_CAMERA_PERMISSION", @"Camera permission is required to scan documents", nil);
      return;
    }

    void (^presentCamera)(void) = ^{
      self.resolve = resolve;
      self.reject = reject;

      LiveDocumentCameraViewController *camera = [[LiveDocumentCameraViewController alloc] init];
      camera.modalPresentationStyle = UIModalPresentationFullScreen;
      __weak SinglePageScanner *weakSelf = self;
      camera.onFinished = ^(UIImage *_Nullable image, BOOL cancelled) {
        SinglePageScanner *strongSelf = weakSelf;
        if (!strongSelf) {
          return;
        }
        if (cancelled) {
          if (strongSelf.resolve) {
            strongSelf.resolve(@{ @"didCancel": @YES });
          }
          strongSelf.resolve = nil;
          strongSelf.reject = nil;
          return;
        }
        if (!image) {
          if (strongSelf.reject) {
            strongSelf.reject(@"NO_IMAGE", @"No image was captured", nil);
          }
          strongSelf.resolve = nil;
          strongSelf.reject = nil;
          return;
        }
        NSDictionary *asset = [strongSelf mapImage:image];
        if (strongSelf.resolve) {
          strongSelf.resolve(@{ @"image": asset });
        }
        strongSelf.resolve = nil;
        strongSelf.reject = nil;
      };

      UIViewController *presenter = RCTPresentedViewController();
      if (!presenter) {
        reject(@"NO_PRESENTER", @"Could not present the camera", nil);
        self.resolve = nil;
        self.reject = nil;
        return;
      }
      [presenter presentViewController:camera animated:YES completion:nil];
    };

    if (status == AVAuthorizationStatusNotDetermined) {
      [AVCaptureDevice requestAccessForMediaType:AVMediaTypeVideo completionHandler:^(BOOL granted) {
        dispatch_async(dispatch_get_main_queue(), ^{
          if (!granted) {
            reject(@"NO_CAMERA_PERMISSION", @"Camera permission is required to scan documents", nil);
            return;
          }
          presentCamera();
        });
      }];
      return;
    }

    presentCamera();
  });
}

- (NSDictionary *)mapImage:(UIImage *)image
{
  NSData *data = UIImageJPEGRepresentation(image, 0.92);
  NSString *fileName = [[[NSUUID UUID] UUIDString] stringByAppendingString:@".jpg"];
  NSString *path = [NSTemporaryDirectory() stringByAppendingPathComponent:fileName];
  [data writeToFile:path atomically:YES];

  CGFloat pixelWidth = image.size.width * image.scale;
  CGFloat pixelHeight = image.size.height * image.scale;

  return @{
    @"uri": [[NSURL fileURLWithPath:path] absoluteString],
    @"fileName": fileName,
    @"type": @"image/jpeg",
    @"width": @((int)pixelWidth),
    @"height": @((int)pixelHeight),
    @"fileSize": @(data.length),
  };
}

@end
