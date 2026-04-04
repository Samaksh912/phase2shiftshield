import 'package:flutter/material.dart';
import 'dart:math';
import '../../../theme/app_colors.dart';

class AnimatedNetworkBackground extends StatefulWidget {
  final Widget child;

  const AnimatedNetworkBackground({super.key, required this.child});

  @override
  State<AnimatedNetworkBackground> createState() => _AnimatedNetworkBackgroundState();
}

class _AnimatedNetworkBackgroundState extends State<AnimatedNetworkBackground> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  final List<NetworkNode> _nodes = [];

  @override
  void initState() {
    super.initState();
    // This controller acts as the heartbeat, constantly ticking to drive the animation
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 10),
    )..repeat(); // Loop indefinitely
  }

  @override
  void dispose() {
    _controller.dispose(); // Always dispose controllers to prevent memory leaks
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors; 

    return Container(
      color: colors.surface, 
      child: LayoutBuilder(
        builder: (context, constraints) {
          // Generate the nodes only once we know the actual screen size
          if (_nodes.isEmpty && constraints.maxWidth > 0) {
            final random = Random();
            for (int i = 0; i < 35; i++) {
              _nodes.add(NetworkNode(
                x: random.nextDouble() * constraints.maxWidth,
                y: random.nextDouble() * constraints.maxHeight,
                // Assign random velocities so they move in different directions
                vx: (random.nextDouble() - 0.5) * 1.2, 
                vy: (random.nextDouble() - 0.5) * 1.2,
              ));
            }
          }

          return CustomPaint(
            painter: _AnimatedNetworkPainter(
              animation: _controller, // Pass the controller to trigger repaints
              nodes: _nodes,
              lineColor: colors.primary.withValues(alpha: 0.25), // Lightened opacity back slightly
              nodeColor: colors.primary.withValues(alpha: 0.5),  // Lightened opacity back slightly
              width: constraints.maxWidth,
              height: constraints.maxHeight,
            ),
            child: widget.child, 
          );
        },
      ),
    );
  }
}

// A simple class to hold the position and speed of each dot
class NetworkNode {
  double x, y, vx, vy;
  NetworkNode({required this.x, required this.y, required this.vx, required this.vy});
}

class _AnimatedNetworkPainter extends CustomPainter {
  final List<NetworkNode> nodes;
  final Color lineColor;
  final Color nodeColor;
  final double width;
  final double height;

  _AnimatedNetworkPainter({
    required Animation<double> animation,
    required this.nodes,
    required this.lineColor,
    required this.nodeColor,
    required this.width,
    required this.height,
  }) : super(repaint: animation); // The secret sauce: tells CustomPainter to redraw every frame of the animation

  @override
  void paint(Canvas canvas, Size size) {
    if (width == 0 || height == 0) return;

    final paintLine = Paint()
      ..color = lineColor
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;

    final paintNode = Paint()
      ..color = nodeColor
      ..style = PaintingStyle.fill;

    // 1. Move the nodes and make them bounce off the screen edges
    for (var node in nodes) {
      node.x += node.vx;
      node.y += node.vy;

      // Bounce horizontally
      if (node.x <= 0 || node.x >= width) node.vx *= -1;
      // Bounce vertically
      if (node.y <= 0 || node.y >= height) node.vy *= -1;
    }

    // 2. Draw lines between nodes that get close to each other
    for (int i = 0; i < nodes.length; i++) {
      for (int j = i + 1; j < nodes.length; j++) {
        double dx = nodes[i].x - nodes[j].x;
        double dy = nodes[i].y - nodes[j].y;
        double distance = sqrt(dx * dx + dy * dy);

        // If they are within 120 pixels, connect them with a line
        if (distance < 120) {
          // Optional: You can make lines fade out as they get further away
          final opacity = (1.0 - (distance / 120)).clamp(0.0, 1.0);
          paintLine.color = lineColor.withValues(alpha: lineColor.a * opacity);
          
          canvas.drawLine(
            Offset(nodes[i].x, nodes[i].y),
            Offset(nodes[j].x, nodes[j].y),
            paintLine,
          );
        }
      }
    }

    // 3. Draw the actual dots over the lines
    for (var node in nodes) {
      canvas.drawCircle(Offset(node.x, node.y), 3.0, paintNode);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
