use qrcode::QrCode;
use qrcode::render::svg;

/// Generates an SVG string representation of a QR Code for a given payload URL.
pub fn generate_qr_svg(payload: &str) -> Result<String, String> {
    let code = QrCode::new(payload.as_bytes())
        .map_err(|e| format!("Failed to create QR code: {:?}", e))?;
    
    let svg_string = code.render::<svg::Color>()
        .min_dimensions(256, 256)
        .build();
    
    Ok(svg_string)
}
