//
// SinglePageScanner.mm
// Live AVFoundation camera + Apple Vision edges → shutter / auto-capture + crop.
//

#import "SinglePageScanner.h"
#import <React/RCTUtils.h>
#import <AVFoundation/AVFoundation.h>
#import <Vision/Vision.h>
#import <CoreImage/CoreImage.h>

// Set to NO to hide the live "Use a dark background" shutter popup / hint.
static const BOOL kShowWhiteBackgroundWarning = YES;

#pragma mark - Live camera

@interface LiveDocumentCameraViewController : UIViewController <AVCaptureVideoDataOutputSampleBufferDelegate, AVCapturePhotoCaptureDelegate>
@property (nonatomic, copy) void (^onFinished)(UIImage *_Nullable image, BOOL cancelled);
@property (nonatomic, copy) NSString *documentSide;
@property (nonatomic, copy) NSString *documentType;
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
  BOOL _documentTooClose;
  BOOL _whiteBackgroundDetected;
  BOOL _isShowingAlert;
  BOOL _captureGateBusy;
  BOOL _hasLiveDocument;
  NSInteger _frameSkip;
  VNRectangleObservation *_latestObservation;
  CGSize _latestBufferSize;
  CGRect _guideRect;
  CVPixelBufferRef _latestPixelBuffer; // retained; accessed on _visionQueue
  CFAbsoluteTime _stableSince;
  CGRect _stableNormalizedBox;
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
  _latestPixelBuffer = NULL;
  _stableSince = 0;
  _stableNormalizedBox = CGRectNull;

  [self buildPreview];
  [self buildCropOverlay];
  [self buildControls];
  [self configureSession];
}

- (void)dealloc
{
  if (_latestPixelBuffer) {
    CVPixelBufferRelease(_latestPixelBuffer);
    _latestPixelBuffer = NULL;
  }
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

  // Corner brackets only — no full border (viewfinder look).
  _cornerLayer = [CAShapeLayer layer];
  _cornerLayer.fillColor = nil;
  _cornerLayer.strokeColor = [[UIColor whiteColor] CGColor];
  _cornerLayer.lineWidth = 4.0;
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
  BOOL isBack = [self.documentSide isEqualToString:@"back"];
  NSString *documentLabel = [self.documentType isEqualToString:@"passport"]
    ? @"passport"
    : @"driving licence";
  _titleLabel.text = isBack ? @"Back side" : @"Front side";
  _titleLabel.textColor = [UIColor whiteColor];
  _titleLabel.font = [UIFont systemFontOfSize:18 weight:UIFontWeightBold];
  _titleLabel.textAlignment = NSTextAlignmentCenter;
  _titleLabel.translatesAutoresizingMaskIntoConstraints = NO;
  [self.view addSubview:_titleLabel];

  _hintLabel = [[UILabel alloc] init];
  _hintLabel.text = [NSString stringWithFormat:@"Position the %@ within the frame", documentLabel];
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

  _cornerLayer.path = [self cornerBracketsPathInRect:_guideRect length:32 cornerRadius:10].CGPath;
  _cornerLayer.frame = bounds;
}

- (UIBezierPath *)cornerBracketsPathInRect:(CGRect)rect length:(CGFloat)length cornerRadius:(CGFloat)radius
{
  UIBezierPath *path = [UIBezierPath bezierPath];
  CGFloat minX = CGRectGetMinX(rect);
  CGFloat minY = CGRectGetMinY(rect);
  CGFloat maxX = CGRectGetMaxX(rect);
  CGFloat maxY = CGRectGetMaxY(rect);

  // Top-left — rounded outer corner
  [path moveToPoint:CGPointMake(minX, minY + length)];
  [path addLineToPoint:CGPointMake(minX, minY + radius)];
  [path addArcWithCenter:CGPointMake(minX + radius, minY + radius)
                  radius:radius
              startAngle:(CGFloat)M_PI
                endAngle:(CGFloat)(3.0 * M_PI / 2.0)
               clockwise:YES];
  [path addLineToPoint:CGPointMake(minX + length, minY)];

  // Top-right
  [path moveToPoint:CGPointMake(maxX - length, minY)];
  [path addLineToPoint:CGPointMake(maxX - radius, minY)];
  [path addArcWithCenter:CGPointMake(maxX - radius, minY + radius)
                  radius:radius
              startAngle:(CGFloat)(3.0 * M_PI / 2.0)
                endAngle:0
               clockwise:YES];
  [path addLineToPoint:CGPointMake(maxX, minY + length)];

  // Bottom-right
  [path moveToPoint:CGPointMake(maxX, maxY - length)];
  [path addLineToPoint:CGPointMake(maxX, maxY - radius)];
  [path addArcWithCenter:CGPointMake(maxX - radius, maxY - radius)
                  radius:radius
              startAngle:0
                endAngle:(CGFloat)(M_PI / 2.0)
               clockwise:YES];
  [path addLineToPoint:CGPointMake(maxX - length, maxY)];

  // Bottom-left
  [path moveToPoint:CGPointMake(minX + length, maxY)];
  [path addLineToPoint:CGPointMake(minX + radius, maxY)];
  [path addArcWithCenter:CGPointMake(minX + radius, maxY - radius)
                  radius:radius
              startAngle:(CGFloat)(M_PI / 2.0)
                endAngle:(CGFloat)M_PI
               clockwise:YES];
  [path addLineToPoint:CGPointMake(minX, maxY - length)];

  return path;
}

#pragma mark - Session

- (void)configureSession
{
  _session = [[AVCaptureSession alloc] init];

  dispatch_async(_sessionQueue, ^{
    [self->_session beginConfiguration];
    if ([self->_session canSetSessionPreset:AVCaptureSessionPresetPhoto]) {
      self->_session.sessionPreset = AVCaptureSessionPresetPhoto;
    } else if ([self->_session canSetSessionPreset:AVCaptureSessionPresetHigh]) {
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

    NSError *lockError = nil;
    if ([device lockForConfiguration:&lockError]) {
      if ([device isFocusModeSupported:AVCaptureFocusModeContinuousAutoFocus]) {
        device.focusMode = AVCaptureFocusModeContinuousAutoFocus;
      }
      if ([device isExposureModeSupported:AVCaptureExposureModeContinuousAutoExposure]) {
        device.exposureMode = AVCaptureExposureModeContinuousAutoExposure;
      }
      if ([device isWhiteBalanceModeSupported:AVCaptureWhiteBalanceModeContinuousAutoWhiteBalance]) {
        device.whiteBalanceMode = AVCaptureWhiteBalanceModeContinuousAutoWhiteBalance;
      }
      [device unlockForConfiguration];
    }

    self->_photoOutput = [[AVCapturePhotoOutput alloc] init];
    if (@available(iOS 13.0, *)) {
      self->_photoOutput.maxPhotoQualityPrioritization = AVCapturePhotoQualityPrioritizationQuality;
    }
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
  dispatch_async(_visionQueue, ^{
    [self retainLatestPixelBuffer:NULL];
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
  [self attemptCaptureFromUserAction:YES];
}

/**
 * Manual shutter + auto-capture both go through here.
 * ALWAYS re-analyze the retained latest frame on the vision queue so popups
 * do not depend on async live flags (Vision often finds nothing live when the
 * ID is close / low-contrast / on a monitor).
 */
- (void)attemptCaptureFromUserAction:(BOOL)fromUser
{
  if (_isCapturing || !_photoOutput || _isShowingAlert || _captureGateBusy) {
    return;
  }
  _captureGateBusy = YES;

  dispatch_async(_visionQueue, ^{
    BOOL tooClose = NO;
    BOOL whiteBackground = NO;
    [self analyzeRetainedFrameForTooClose:&tooClose whiteBackground:&whiteBackground];

    dispatch_async(dispatch_get_main_queue(), ^{
      self->_documentTooClose = tooClose;
      self->_whiteBackgroundDetected = kShowWhiteBackgroundWarning ? whiteBackground : NO;
      [self updateHintForCurrentState];

      if (tooClose) {
        self->_captureGateBusy = NO;
        [self showBlockingAlertWithTitle:@"Move farther away"
                                 message:@"The document is too close to the camera. Hold your phone back so the whole ID fits clearly inside the frame."];
        return;
      }
      if (kShowWhiteBackgroundWarning && whiteBackground) {
        self->_captureGateBusy = NO;
        [self showBlockingAlertWithTitle:@"Use a dark background"
                                 message:@"The scanner works best on a dark, non-glossy surface. Move the document onto a darker background, then try again."];
        return;
      }

      // Auto-capture only when a live document is framed (manual shutter may
      // still fire without a Vision hit so users are never stuck).
      if (!fromUser && !self->_hasLiveDocument) {
        self->_captureGateBusy = NO;
        return;
      }

      self->_captureGateBusy = NO;
      [self beginPhotoCapture];
    });
  });
}

- (void)beginPhotoCapture
{
  if (_isCapturing || !_photoOutput) {
    return;
  }
  _isCapturing = YES;
  _shutterButton.enabled = NO;
  _stableSince = 0;

  AVCapturePhotoSettings *settings = [AVCapturePhotoSettings photoSettings];
  if (_photoOutput.supportedFlashModes.count > 0) {
    settings.flashMode = AVCaptureFlashModeOff;
  }
  [_photoOutput capturePhotoWithSettings:settings delegate:self];
}

- (void)showBlockingAlertWithTitle:(NSString *)title message:(NSString *)message
{
  if (_isShowingAlert) {
    return;
  }
  _isShowingAlert = YES;
  _stableSince = 0;
  UIAlertController *alert =
    [UIAlertController alertControllerWithTitle:title
                                        message:message
                                 preferredStyle:UIAlertControllerStyleAlert];
  __weak LiveDocumentCameraViewController *weakSelf = self;
  [alert addAction:[UIAlertAction actionWithTitle:@"OK"
                                            style:UIAlertActionStyleDefault
                                          handler:^(__unused UIAlertAction *action) {
    LiveDocumentCameraViewController *strongSelf = weakSelf;
    if (strongSelf) {
      strongSelf->_isShowingAlert = NO;
    }
  }]];
  [self presentViewController:alert animated:YES completion:nil];
}

#pragma mark - Frame analysis (vision queue)

- (void)retainLatestPixelBuffer:(CVPixelBufferRef)pixelBuffer
{
  if (pixelBuffer == _latestPixelBuffer) {
    return;
  }
  if (_latestPixelBuffer) {
    CVPixelBufferRelease(_latestPixelBuffer);
    _latestPixelBuffer = NULL;
  }
  if (pixelBuffer) {
    CVPixelBufferRetain(pixelBuffer);
    _latestPixelBuffer = pixelBuffer;
  }
}

- (NSArray<VNRectangleObservation *> *)detectDocumentCandidatesInPixelBuffer:(CVPixelBufferRef)pixelBuffer
                                                                orientation:(CGImagePropertyOrientation)orientation
{
  NSMutableArray<VNRectangleObservation *> *candidates = [NSMutableArray array];
  if (!pixelBuffer) {
    return candidates;
  }

  VNImageRequestHandler *handler =
    [[VNImageRequestHandler alloc] initWithCVPixelBuffer:pixelBuffer
                                             orientation:orientation
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

  // Always also run rectangles — document segmentation often fails on screens /
  // low-contrast / very close IDs, while rectangle detection still finds a quad.
  VNDetectRectanglesRequest *rectRequest = [[VNDetectRectanglesRequest alloc] init];
  rectRequest.maximumObservations = 12;
  rectRequest.minimumConfidence = 0.15;
  rectRequest.minimumAspectRatio = 0.25;
  rectRequest.maximumAspectRatio = 1.0;
  rectRequest.minimumSize = 0.05;
  rectRequest.quadratureTolerance = 40.0;
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
  return candidates;
}

- (BOOL)tooCloseFromAnyCandidate:(NSArray<VNRectangleObservation *> *)candidates
{
  for (VNRectangleObservation *obs in candidates) {
    CGFloat area = obs.boundingBox.size.width * obs.boundingBox.size.height;
    CGFloat w = hypot(obs.topRight.x - obs.topLeft.x, obs.topRight.y - obs.topLeft.y);
    CGFloat h = hypot(obs.bottomLeft.x - obs.topLeft.x, obs.bottomLeft.y - obs.topLeft.y);
    CGFloat maxEdge = MAX(w, h);
    if (area >= 0.52 || maxEdge >= 0.90) {
      return YES;
    }
  }
  return NO;
}

/**
 * Luma mean + variance over whole frame, outer border, and 4 corners.
 * High mean + low variance on border/corner ⇒ white/light surface.
 */
- (BOOL)isWhiteBackgroundInPixelBuffer:(CVPixelBufferRef)pixelBuffer
{
  if (!pixelBuffer) {
    return NO;
  }

  CVPixelBufferLockBaseAddress(pixelBuffer, kCVPixelBufferLock_ReadOnly);
  const uint8_t *base = (const uint8_t *)CVPixelBufferGetBaseAddress(pixelBuffer);
  if (!base) {
    CVPixelBufferUnlockBaseAddress(pixelBuffer, kCVPixelBufferLock_ReadOnly);
    return NO;
  }

  size_t width = CVPixelBufferGetWidth(pixelBuffer);
  size_t height = CVPixelBufferGetHeight(pixelBuffer);
  size_t bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer);
  OSType format = CVPixelBufferGetPixelFormatType(pixelBuffer);
  if (format != kCVPixelFormatType_32BGRA || width < 16 || height < 16) {
    CVPixelBufferUnlockBaseAddress(pixelBuffer, kCVPixelBufferLock_ReadOnly);
    return NO;
  }

  // Looser than Android post-capture — live desk surfaces under room light
  // are rarely 230+ mean; ~175 + moderate variance still reads as "white paper".
  const double wholeBright = 185.0;
  const double wholeVarMax = 2200.0;
  const double borderBright = 175.0;
  const double borderVarMax = 1800.0;
  const double cornerBright = 175.0;
  const double cornerVarMax = 1600.0;

  __block double sum = 0;
  __block double sumSq = 0;
  __block int count = 0;

  void (^accum)(size_t, size_t) = ^(size_t x, size_t y) {
    if (x >= width || y >= height) {
      return;
    }
    const uint8_t *px = base + y * bytesPerRow + x * 4;
    double luma = 0.299 * px[2] + 0.587 * px[1] + 0.114 * px[0];
    sum += luma;
    sumSq += luma * luma;
    count += 1;
  };

  // Whole-image coarse grid.
  size_t stepX = MAX(1, width / 32);
  size_t stepY = MAX(1, height / 32);
  for (size_t y = 0; y < height; y += stepY) {
    for (size_t x = 0; x < width; x += stepX) {
      accum(x, y);
    }
  }
  double wholeMean = count > 0 ? sum / count : 0;
  double wholeVar = count > 0 ? MAX(0.0, (sumSq / count) - (wholeMean * wholeMean)) : 0;
  BOOL whiteWhole = wholeMean >= wholeBright && wholeVar <= wholeVarMax;

  // Outer ~8% border strip.
  sum = 0; sumSq = 0; count = 0;
  size_t borderW = MAX(2, (size_t)(width * 0.08));
  size_t borderH = MAX(2, (size_t)(height * 0.08));
  size_t bStepX = MAX(1, width / 48);
  size_t bStepY = MAX(1, height / 48);
  for (size_t y = 0; y < borderH; y += bStepY) {
    for (size_t x = 0; x < width; x += bStepX) {
      accum(x, y);
    }
  }
  for (size_t y = height > borderH ? height - borderH : 0; y < height; y += bStepY) {
    for (size_t x = 0; x < width; x += bStepX) {
      accum(x, y);
    }
  }
  for (size_t y = borderH; y + borderH < height; y += bStepY) {
    for (size_t x = 0; x < borderW; x += bStepX) {
      accum(x, y);
    }
    for (size_t x = width > borderW ? width - borderW : 0; x < width; x += bStepX) {
      accum(x, y);
    }
  }
  double borderMean = count > 0 ? sum / count : 0;
  double borderVar = count > 0 ? MAX(0.0, (sumSq / count) - (borderMean * borderMean)) : 0;
  BOOL whiteBorder = borderMean >= borderBright && borderVar <= borderVarMax;

  // Four corner patches.
  BOOL whiteCorner = NO;
  size_t patchW = MAX(8, (size_t)(width * 0.12));
  size_t patchH = MAX(8, (size_t)(height * 0.12));
  size_t strideX = MAX(1, patchW / 16);
  size_t strideY = MAX(1, patchH / 16);
  size_t origins[4][2] = {
    {0, 0},
    {width > patchW ? width - patchW : 0, 0},
    {0, height > patchH ? height - patchH : 0},
    {width > patchW ? width - patchW : 0, height > patchH ? height - patchH : 0},
  };
  for (int c = 0; c < 4; c++) {
    sum = 0; sumSq = 0; count = 0;
    size_t x0 = origins[c][0];
    size_t y0 = origins[c][1];
    for (size_t y = y0; y < y0 + patchH && y < height; y += strideY) {
      for (size_t x = x0; x < x0 + patchW && x < width; x += strideX) {
        accum(x, y);
      }
    }
    if (count <= 0) {
      continue;
    }
    double mean = sum / count;
    double variance = MAX(0.0, (sumSq / count) - (mean * mean));
    if (mean >= cornerBright && variance <= cornerVarMax) {
      whiteCorner = YES;
      break;
    }
  }

  CVPixelBufferUnlockBaseAddress(pixelBuffer, kCVPixelBufferLock_ReadOnly);
  return whiteWhole || whiteBorder || whiteCorner;
}

/**
 * Extra too-close signal when Vision finds nothing: lens near macro + bright fill.
 */
- (BOOL)isLikelyTooCloseWithoutDocument
{
  AVCaptureDevice *device = _deviceInput.device;
  if (!device) {
    return NO;
  }
  // lensPosition ~1.0 = minimum focus distance (very close subject).
  return device.lensPosition >= 0.82f;
}

- (void)analyzeRetainedFrameForTooClose:(BOOL *)outTooClose
                        whiteBackground:(BOOL *)outWhiteBackground
{
  BOOL tooClose = NO;
  BOOL whiteBackground = NO;
  CVPixelBufferRef buffer = _latestPixelBuffer;
  if (buffer) {
    CGSize bufferSize = CGSizeMake(CVPixelBufferGetWidth(buffer), CVPixelBufferGetHeight(buffer));
    CGImagePropertyOrientation orientation = kCGImagePropertyOrientationUp;
    if (bufferSize.width > bufferSize.height) {
      orientation = kCGImagePropertyOrientationRight;
    }
    NSArray<VNRectangleObservation *> *candidates =
      [self detectDocumentCandidatesInPixelBuffer:buffer orientation:orientation];
    tooClose = [self tooCloseFromAnyCandidate:candidates];
    whiteBackground = [self isWhiteBackgroundInPixelBuffer:buffer];

    VNRectangleObservation *best = [self bestObservationIn:candidates];
    if (!tooClose && best) {
      CGFloat area = best.boundingBox.size.width * best.boundingBox.size.height;
      if (area >= 0.52) {
        tooClose = YES;
      }
    }
    if (!tooClose && !best && [self isLikelyTooCloseWithoutDocument] && whiteBackground) {
      // Macro focus + washed frame while Vision can't find edges ⇒ usually too close.
      tooClose = YES;
      whiteBackground = NO; // prefer the distance message
    }
  } else if ([self isLikelyTooCloseWithoutDocument]) {
    tooClose = YES;
  }

  if (outTooClose) {
    *outTooClose = tooClose;
  }
  if (outWhiteBackground) {
    *outWhiteBackground = whiteBackground;
  }
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

  [self retainLatestPixelBuffer:pixelBuffer];

  CGSize bufferSize = CGSizeMake(CVPixelBufferGetWidth(pixelBuffer), CVPixelBufferGetHeight(pixelBuffer));
  CGImagePropertyOrientation orientation = kCGImagePropertyOrientationUp;
  if (bufferSize.width > bufferSize.height) {
    orientation = kCGImagePropertyOrientationRight;
  }

  NSArray<VNRectangleObservation *> *candidates =
    [self detectDocumentCandidatesInPixelBuffer:pixelBuffer orientation:orientation];
  BOOL tooCloseFromVision = [self tooCloseFromAnyCandidate:candidates];
  VNRectangleObservation *best = [self bestObservationIn:candidates];

  BOOL shouldSampleWhite = (_frameSkip % 4 == 0);
  BOOL whiteBackground = NO;
  if (shouldSampleWhite) {
    whiteBackground = [self isWhiteBackgroundInPixelBuffer:pixelBuffer];
  }

  if (!tooCloseFromVision && !best && [self isLikelyTooCloseWithoutDocument] && shouldSampleWhite && whiteBackground) {
    tooCloseFromVision = YES;
  }

  _latestObservation = best;
  CGSize mappingSize = bufferSize;
  if (orientation == kCGImagePropertyOrientationRight) {
    mappingSize = CGSizeMake(bufferSize.height, bufferSize.width);
  }
  _latestBufferSize = mappingSize;

  dispatch_async(dispatch_get_main_queue(), ^{
    if (shouldSampleWhite) {
      self->_whiteBackgroundDetected =
        kShowWhiteBackgroundWarning && whiteBackground && !tooCloseFromVision;
    }
    [self renderDetectedOverlay:best
                     bufferSize:mappingSize
              tooCloseFromVision:tooCloseFromVision];
    [self maybeAutoCaptureWithObservation:best];
  });
}

- (BOOL)isPlausibleDocumentObservation:(VNRectangleObservation *)obs
{
  CGFloat area = obs.boundingBox.size.width * obs.boundingBox.size.height;
  return area >= 0.04 && area <= 0.90;
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

- (BOOL)isDocumentTooCloseInView:(VNRectangleObservation *)observation
                         topLeft:(CGPoint)tl
                        topRight:(CGPoint)tr
                     bottomRight:(CGPoint)br
                      bottomLeft:(CGPoint)bl
{
  if (!observation) {
    return NO;
  }

  CGFloat area = observation.boundingBox.size.width * observation.boundingBox.size.height;
  if (area >= 0.52) {
    return YES;
  }

  CGFloat minX = MIN(MIN(tl.x, tr.x), MIN(bl.x, br.x));
  CGFloat maxX = MAX(MAX(tl.x, tr.x), MAX(bl.x, br.x));
  CGFloat minY = MIN(MIN(tl.y, tr.y), MIN(bl.y, br.y));
  CGFloat maxY = MAX(MAX(tl.y, tr.y), MAX(bl.y, br.y));
  CGFloat docW = maxX - minX;
  CGFloat docH = maxY - minY;

  if (!CGRectIsEmpty(_guideRect) &&
      (docW > _guideRect.size.width * 1.08 || docH > _guideRect.size.height * 1.08)) {
    return YES;
  }

  CGRect bounds = self.view.bounds;
  CGFloat margin = 12.0;
  if (minX < margin || minY < margin ||
      maxX > bounds.size.width - margin || maxY > bounds.size.height - margin) {
    return YES;
  }

  return NO;
}

- (void)updateHintForCurrentState
{
  if (_documentTooClose) {
    _cornerLayer.strokeColor = [[UIColor colorWithRed:1.0 green:0.72 blue:0.2 alpha:1] CGColor];
    _detectedLayer.strokeColor = [[UIColor colorWithRed:1.0 green:0.72 blue:0.2 alpha:1] CGColor];
    _hintLabel.text = @"Too close — move farther away";
    return;
  }
  if (kShowWhiteBackgroundWarning && _whiteBackgroundDetected) {
    _cornerLayer.strokeColor = [[UIColor colorWithRed:1.0 green:0.72 blue:0.2 alpha:1] CGColor];
    _detectedLayer.strokeColor = [[UIColor colorWithRed:1.0 green:0.72 blue:0.2 alpha:1] CGColor];
    _hintLabel.text = @"Use a dark background";
    return;
  }
  if (_hasLiveDocument) {
    _cornerLayer.strokeColor = [[UIColor colorWithRed:0.35 green:0.9 blue:0.45 alpha:1] CGColor];
    _detectedLayer.strokeColor = [[UIColor colorWithRed:0.55 green:0.95 blue:0.55 alpha:1] CGColor];
    if (_stableSince > 0) {
      _hintLabel.text = @"Hold steady… capturing";
    } else {
      _hintLabel.text = @"Document detected — hold steady";
    }
    return;
  }
  _cornerLayer.strokeColor = [[UIColor whiteColor] CGColor];
  _hintLabel.text = @"Fit the ID inside the frame";
}

- (void)renderDetectedOverlay:(VNRectangleObservation *)observation
                   bufferSize:(CGSize)bufferSize
            tooCloseFromVision:(BOOL)tooCloseFromVision
{
  BOOL tooClose = tooCloseFromVision;
  _hasLiveDocument = (observation != nil);

  if (!observation) {
    _detectedLayer.path = nil;
    _detectedFill.path = nil;
    _documentTooClose = tooClose;
    _stableSince = 0;
    [self updateHintForCurrentState];
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

  if ([self isDocumentTooCloseInView:observation
                             topLeft:tl
                            topRight:tr
                         bottomRight:br
                          bottomLeft:bl]) {
    tooClose = YES;
  }

  _documentTooClose = tooClose;
  if (tooClose) {
    _stableSince = 0;
  }
  [self updateHintForCurrentState];
}

- (void)maybeAutoCaptureWithObservation:(VNRectangleObservation *)observation
{
  if (_isCapturing || _isShowingAlert || !observation || _documentTooClose ||
      (kShowWhiteBackgroundWarning && _whiteBackgroundDetected)) {
    _stableSince = 0;
    return;
  }

  CGRect box = observation.boundingBox;
  const CGFloat moveTolerance = 0.045;
  BOOL moved = YES;
  if (!CGRectIsNull(_stableNormalizedBox)) {
    CGFloat dx = fabs(CGRectGetMidX(box) - CGRectGetMidX(_stableNormalizedBox));
    CGFloat dy = fabs(CGRectGetMidY(box) - CGRectGetMidY(_stableNormalizedBox));
    CGFloat dw = fabs(box.size.width - _stableNormalizedBox.size.width);
    CGFloat dh = fabs(box.size.height - _stableNormalizedBox.size.height);
    moved = (dx > moveTolerance || dy > moveTolerance || dw > moveTolerance || dh > moveTolerance);
  }

  CFAbsoluteTime now = CFAbsoluteTimeGetCurrent();
  if (moved) {
    _stableNormalizedBox = box;
    _stableSince = now;
    [self updateHintForCurrentState];
    return;
  }

  if (_stableSince <= 0) {
    _stableSince = now;
    [self updateHintForCurrentState];
    return;
  }

  // ~0.9s of a stable, well-framed document ⇒ auto capture.
  if ((now - _stableSince) >= 0.90) {
    _stableSince = 0;
    _hintLabel.text = @"Capturing…";
    [self attemptCaptureFromUserAction:NO];
  } else {
    [self updateHintForCurrentState];
  }
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
      self->_stableSince = 0;
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

RCT_EXPORT_METHOD(requestCameraPermission:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    AVAuthorizationStatus status = [AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeVideo];
    if (status == AVAuthorizationStatusAuthorized) {
      resolve(@{ @"granted": @YES, @"status": @"granted" });
      return;
    }
    if (status == AVAuthorizationStatusDenied || status == AVAuthorizationStatusRestricted) {
      resolve(@{ @"granted": @NO, @"status": @"denied" });
      return;
    }

    [AVCaptureDevice requestAccessForMediaType:AVMediaTypeVideo
                             completionHandler:^(BOOL granted) {
      dispatch_async(dispatch_get_main_queue(), ^{
        resolve(@{
          @"granted": @(granted),
          @"status": granted ? @"granted" : @"denied",
        });
      });
    }];
  });
}

RCT_EXPORT_METHOD(launch:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
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
      camera.documentSide = [options[@"side"] isKindOfClass:[NSString class]]
        ? options[@"side"]
        : @"front";
      camera.documentType = [options[@"documentType"] isKindOfClass:[NSString class]]
        ? options[@"documentType"]
        : @"driving_licence";
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

  NSInteger pixelWidth = 0;
  NSInteger pixelHeight = 0;
  CGImageRef cgImage = image.CGImage;
  if (cgImage) {
    pixelWidth = (NSInteger)CGImageGetWidth(cgImage);
    pixelHeight = (NSInteger)CGImageGetHeight(cgImage);
  }
  if (pixelWidth <= 0 || pixelHeight <= 0) {
    pixelWidth = (NSInteger)lround(image.size.width * image.scale);
    pixelHeight = (NSInteger)lround(image.size.height * image.scale);
  }

  return @{
    @"uri": [[NSURL fileURLWithPath:path] absoluteString],
    @"fileName": fileName,
    @"type": @"image/jpeg",
    @"width": @(pixelWidth),
    @"height": @(pixelHeight),
    @"fileSize": @(data.length),
  };
}

@end
